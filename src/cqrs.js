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
        this.eventCounter = 0;
        // save reference to domain Event
        events.forEach(function (event) {
            _this.domainEvents[event.name] = event;
            event.store = _this;
        });

        this.initPromise = Q.nfcall(mongodb.MongoClient.connect, this.uri).then(function (db) {
            _this.db = db;
            _this.collection = db.collection('events');

            return Q.ninvoke(_this.collection, 'aggregate', [{ $group: { _id: 0, eventCounter: { $max: "$eventCounter" } } }]);
        }).then(function (agregate) {
            //set current event Counter position
            if (agregate.length === 1) {
                _this.eventCounter = agregate[0].eventCounter;
            }
        });
    }
    MongoEventStore.prototype.close = function () {
        this.db.close();
    };

    MongoEventStore.prototype.save = function (event) {
        var _this = this;
        this.eventCounter += 1;
        event.eventCounter = this.eventCounter;

        return this.initPromise.then(function () {
            return Q.ninvoke(_this.collection, 'insert', event).then(function () {
            });
        });
    };

    MongoEventStore.prototype.restore = function () {
        var _this = this;
        return this.initPromise.then(function () {
            return Q.ninvoke(_this.collection.find(), 'toArray').then(function (docs) {
                return docs;
            });
        });
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

            return _this.store.save({ name: name, params: params, eventCounter: -1 }).then(function () {
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
var LocalProjection = (function () {
    function LocalProjection(projector) {
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
    LocalProjection.prototype.subscribe = function (subscriber) {
        this.viewers.push(subscriber);
        subscriber(this.projection); // nach dem subscribe direkt die aktuelle projection zurück geben
    };
    return LocalProjection;
})();

var MongoProjection = (function () {
    function MongoProjection(name, uri, eventStore, projector) {
        var _this = this;
        this.name = name;
        this.uri = uri;
        this.eventStore = eventStore;
        this.initPromise = Q.nfcall(mongodb.MongoClient.connect, this.uri).then(function (db) {
            _this.db = db;
            _this.collection = db.collection(name);

            var self = _this;
            var collection = function (mongoCmd, parm) {
                return Q.ninvoke(self.collection, mongoCmd, parm);
            };

            projector(collection);
        });
    }
    MongoProjection.prototype.query = function (params) {
        return Q.ninvoke(this.collection.find(params), 'toArray').then(function (docs) {
            return docs;
        });
    };

    MongoProjection.prototype.close = function () {
        this.db.close();
    };
    return MongoProjection;
})();

// .. client
var createActivityCommand = new Command();

var activityCreatedEvent = new DomainEvent('activityCreatedEvent', createActivityCommand, function (params) {
    // business logic
    return Q(null);
});

var eventStore = new MongoEventStore([activityCreatedEvent], 'mongodb://127.0.0.1:27017/cqrs');

//var eventStore = new LocalEventStore([activityCreatedEvent]);
var activityMongoProjection = new MongoProjection('activityMongoProjection', 'mongodb://127.0.0.1:27017/cqrs', eventStore, function (collection) {
    activityCreatedEvent.handle(function (a) {
        // projection logic
        var owner = 0;
        if (a.owner == 'Jonathan') {
            owner = 1;
        }

        collection('insert', {
            name: a.name,
            owner: owner
        });
    });
});

// ..
//activityOwnerProjection.subscribe((view) => {
//  console.log(view);
//});
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
    return activityMongoProjection.query({});
    //console.log('current Projection', activityOwnerProjection.projection);
}).then(function (activityOwner) {
    console.log('current Mongo Projection', activityOwner);
}).then(function () {
    eventStore.close();
    activityMongoProjection.close();
}).done();
//# sourceMappingURL=cqrs.js.map
