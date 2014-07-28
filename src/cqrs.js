/// <reference path="../typings/tsd.d.ts"/>
var Q = require('q');

var mongodb = require('mongodb');

Q.longStackSupport = true;

////////////////
///// Commands
var Command = (function () {
    function Command() {
    }
    Command.prototype.handle = function (eventHandler) {
        this.eventHandler = eventHandler;
    };

    Command.prototype.execute = function (params) {
        return this.eventHandler(params);
    };
    return Command;
})();


var LocalEventStore = (function () {
    function LocalEventStore(events) {
        var _this = this;
        this.storage = [];
        this.domainEvents = {};
        // save reference to domain Event
        events.forEach(function (event) {
            _this.domainEvents[event.name] = event;
            event.store = _this;
        });
    }
    LocalEventStore.prototype.save = function (event) {
        this.storage.push(event);
        return Q(null);
    };

    LocalEventStore.prototype.restore = function () {
        return Q(this.storage);
    };

    LocalEventStore.prototype.replay = function () {
        var _this = this;
        // replay events
        return this.restore().then(function (events) {
            events.forEach(function (event) {
                // emitte das passende event
                _this.domainEvents[event.name].emit(event.params);
            });
        });
    };

    LocalEventStore.prototype.close = function () {
    };
    return LocalEventStore;
})();

var MongoEventStore = (function () {
    function MongoEventStore(events, uri) {
        var _this = this;
        this.uri = uri;
        this.domainEvents = {};
        // save reference to domain Event
        events.forEach(function (event) {
            _this.domainEvents[event.name] = event;
            event.store = _this;
        });

        this.initPromise = Q.nfcall(mongodb.MongoClient.connect, this.uri).then(function (db) {
            _this.db = db;
            _this.collection = db.collection('events');
        });
    }
    MongoEventStore.prototype.close = function () {
        this.db.close();
    };

    MongoEventStore.prototype.save = function (event) {
        var _this = this;
        var defer = Q.defer();

        this.initPromise.then(function () {
            _this.collection.insert(event, function (err, doc) {
                if (err) {
                    defer.reject(err);
                    return;
                }
                defer.resolve(doc);
            });
        });

        return defer.promise;
        //    return Q.nfcall(this.collection.insert, event);  // warum geht das hier nicht?!
    };

    MongoEventStore.prototype.restore = function () {
        var _this = this;
        var defer = Q.defer();

        this.initPromise.then(function () {
            _this.collection.find().toArray(function (err, docs) {
                if (err) {
                    defer.reject(err);
                    return;
                }
                defer.resolve(docs);
            });
        });

        return defer.promise;
        //    return Q.nfcall(this.collection.find().each)
        //      .then((doc) => {
        //        return <StoredEvent>doc;
        //      })
    };

    MongoEventStore.prototype.replay = function () {
        var _this = this;
        // replay events
        return this.restore().then(function (events) {
            events.forEach(function (event) {
                // emitte das passende event
                _this.domainEvents[event.name].emit(event.params);
            });
        });
    };
    return MongoEventStore;
})();

///////////////////////
// Domain Events
var DomainEvent = (function () {
    function DomainEvent(name, command, businessLogic) {
        var _this = this;
        this.name = name;
        this.projectionHandlers = [];
        // handle a command
        command.handle(function (params) {
            // Hinweis: reihenfolge ist wichtig - sonst kommen events doppel an..
            _this.emit(params); // den projections die sich für das Event interessiern benachrichtigen

            return _this.store.save({ name: name, params: params }).then(function () {
                return businessLogic(params);
            });
        });
    }
    // eine Projektion meldet sich für dieses Event an
    DomainEvent.prototype.handle = function (handler) {
        this.projectionHandlers.push(handler); // projection handler subscriben
    };

    // den projections bescheid geben
    DomainEvent.prototype.emit = function (event) {
        this.projectionHandlers.forEach(function (handler) {
            handler(event);
        });
    };
    return DomainEvent;
})();

/////////////////////
// Projections
var Projection = (function () {
    function Projection(projector) {
        this.projection = [];
        this.viewers = [];
        var self = this;
        var notify = function () {
            self.viewers.forEach(function (viewer) {
                viewer(self.projection);
            });
        };

        projector(this.projection, notify);
    }
    Projection.prototype.subscribe = function (subscriber) {
        this.viewers.push(subscriber);
        subscriber(this.projection); // nach dem subscribe direkt die aktuelle projection zurück geben
    };
    return Projection;
})();

// .. client
var createActivityCommand = new Command();

var activityCreatedEvent = new DomainEvent('activityCreatedEvent', createActivityCommand, function (params) {
    // business logic
    return Q(null);
});

var eventStore = new MongoEventStore([activityCreatedEvent], 'mongodb://127.0.0.1:27017/cqrs');

//var eventStore = new LocalEventStore([activityCreatedEvent]);
var activityOwnerProjection = new Projection(function (projection, notify) {
    activityCreatedEvent.handle(function (a) {
        // projection logic
        var owner = 0;
        if (a.owner == 'Jonathan') {
            owner = 1;
        }

        projection.push({
            name: a.name,
            owner: owner
        });
        notify();
    });
});

// ..
activityOwnerProjection.subscribe(function (view) {
    console.log(view);
});

eventStore.replay().then(function () {
    return createActivityCommand.execute({
        name: "Nabada",
        owner: "Jonathan",
        events: [
            {
                name: "Schwörrede",
                price: 0,
                quantity: 10000
            },
            {
                name: "After Party",
                price: 7,
                quantity: 1000
            }
        ]
    });
}).then(function () {
    console.log('current Projection', activityOwnerProjection.projection);
}).then(function () {
    eventStore.close();
}).done();
//# sourceMappingURL=cqrs.js.map
