/// <reference path="../typings/tsd.d.ts"/>
var __extends = this.__extends || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
var Q = require('q');
Q.longStackSupport = true;

////////////////////////////
// Events
var EventProvider = (function () {
    function EventProvider(name) {
        this.name = name;
        this.eventHandlers = {};
    }
    EventProvider.prototype.handle = function (eventHandler) {
        this.eventHandlers[this.name] = eventHandler;
    };

    EventProvider.prototype.emit = function (event) {
        for (var i in this.eventHandlers) {
            this.eventHandlers[i](event);
        }
    };
    return EventProvider;
})();
exports.EventProvider = EventProvider;

///////////////////////
// Event Handler
// Handelt Events (HanldingLogic) und löst neue Events aus
var EventHandler = (function (_super) {
    __extends(EventHandler, _super);
    function EventHandler(name, eventProvider, handlingLogic) {
        var _this = this;
        _super.call(this, name);

        // als handler für ein command registieren
        eventProvider.handle(function (params) {
            // was passieren soll, wenn das Event ausgelöst wurde
            handlingLogic(params); // die Business Logik für das Event ausführen
            _this.emit(params); // das Event an die hanlder (z.B. Projections) senden, die sich für das Event interessiern
        });
    }
    return EventHandler;
})(EventProvider);
exports.EventHandler = EventHandler;

////////////////
///// Event Store
var StoredEventProvider = (function (_super) {
    __extends(StoredEventProvider, _super);
    function StoredEventProvider(name, collectionName, db) {
        _super.call(this, name);

        this.collection = db.collection(collectionName);
    }
    StoredEventProvider.prototype.emit = function (event) {
        Q.ninvoke(this.collection, 'insert', event); // save Event to db
        _super.prototype.emit.call(this, event);
    };
    return StoredEventProvider;
})(EventProvider);
exports.StoredEventProvider = StoredEventProvider;

////////////////
///// Commands
// Ein Command mit Parametern T
// Ist eine Implementierung für den Server
// verwendet express (später soll das dynamisch ein communicator channel verwenden
var Command = (function (_super) {
    __extends(Command, _super);
    function Command(name) {
        _super.call(this, name);
    }
    return Command;
})(EventProvider);
exports.Command = Command;

// todo verhalten von der projection hier implementieren
var Aggregate = (function (_super) {
    __extends(Aggregate, _super);
    function Aggregate(name, aggregator) {
        _super.call(this, name);

        var self = this;
        var emit = function (params) {
            self.emit(params);
        };

        aggregator(emit);
    }
    return Aggregate;
})(EventProvider);
exports.Aggregate = Aggregate;


var MongoProjection = (function () {
    function MongoProjection(name, db, projector) {
        this.name = name;
        this.collection = db.collection(name);

        var self = this;
        var collection = {
            execute: function (mongoCmd) {
                var parms = [];
                for (var _i = 0; _i < (arguments.length - 1); _i++) {
                    parms[_i] = arguments[_i + 1];
                }
                return Q.npost(self.collection, mongoCmd, parms);
            },
            insert: function (params) {
                return Q.ninvoke(self.collection, 'insert', params);
            }
        };

        projector(collection);
    }
    MongoProjection.prototype.query = function (params) {
        return Q.ninvoke(this.collection.find(params), 'toArray').then(function (docs) {
            return docs;
        });
    };
    return MongoProjection;
})();
exports.MongoProjection = MongoProjection;

/////////////////////////////
// Context
var Context = (function () {
    function Context(name, db) {
        this.name = name;
        this.db = db;
    }
    //  createCommand<T>(cmdName : string) : StoredEventProvider<T> {
    //    return new StoredEventProvider<T>(cmdName, this.name + 'Events', this.db);
    //  }
    Context.prototype.createDomainEvent = function (name, eventProvider, handlingLogic) {
        return new EventHandler(name, eventProvider, handlingLogic);
    };
    return Context;
})();
exports.Context = Context;
//# sourceMappingURL=cqrs3.js.map
