/// <reference path="../typings/tsd.d.ts"/>
var __extends = this.__extends || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
var Q = require('q');
Q.longStackSupport = true;

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Event Providers
/**
*  @EventProvider
*  - you can emit an event of Type T
*  - and register to handle this event
*/
var EventProvider = (function () {
    function EventProvider(name) {
        this.name = name;
        this.eventHandlers = [];
    }
    EventProvider.prototype.handle = function (eventHandler) {
        this.eventHandlers.push(eventHandler);
    };

    EventProvider.prototype.emit = function (event) {
        this.eventHandlers.forEach(function (handler) {
            return handler(event);
        });
    };
    return EventProvider;
})();
exports.EventProvider = EventProvider;

/**
*  @StatefulEventProvider
*  same as a regular @EventProvider
*  but you a parametrize the Event with a "State"
*/
var StatefulEventProvider = (function () {
    function StatefulEventProvider(name) {
        this.name = name;
        this.eventHandlers = [];
    }
    StatefulEventProvider.prototype.handle = function (eventHandler) {
        this.eventHandlers.push(eventHandler);
    };

    StatefulEventProvider.prototype.emit = function (event, state) {
        this.eventHandlers.forEach(function (handler) {
            return handler(event, state);
        });
    };
    return StatefulEventProvider;
})();
exports.StatefulEventProvider = StatefulEventProvider;

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Stateful Event Providers
/**
*  @StatefulStoredEventProvider
*  same as @StatefulEventProvider
*  but all events are stored when you @emit() an event to a MongoDB
*/
var StatefulStoredEventProvider = (function (_super) {
    __extends(StatefulStoredEventProvider, _super);
    function StatefulStoredEventProvider(name, collectionName, db) {
        _super.call(this, name);

        this.collection = db.collection(collectionName);
    }
    StatefulStoredEventProvider.prototype.emit = function (event, state) {
        this.emitQ(event, state);
    };

    StatefulStoredEventProvider.prototype.emitQ = function (event, state) {
        var doc = {
            name: this.name,
            event: event,
            state: state,
            date: new Date()
        };
        _super.prototype.emit.call(this, event, state);
        return Q.ninvoke(this.collection, 'insert', doc);
    };
    return StatefulStoredEventProvider;
})(StatefulEventProvider);
exports.StatefulStoredEventProvider = StatefulStoredEventProvider;

/*  Not Needed  */
//export class StoredEventProvider<T> extends EventProvider<T> {
//  private collection : mongodb.Collection;
//
//  constructor(name:string, collectionName : string, db : mongodb.Db) {
//    super(name);
//
//    this.collection = db.collection(collectionName);
//  }
//
//  public emit(event:T) {
//    var doc = {
//      name : this.name,
//      event : event,
//      date : new Date()
//    };
//    Q.ninvoke<void>(this.collection, 'insert', doc);  // save Event to db
//    super.emit(event);
//  }
//}
///////////////////////
// Event Handler
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

// Handelt Events (HanldingLogic) und löst neue Events aus
var StatefulEventHandler = (function (_super) {
    __extends(StatefulEventHandler, _super);
    function StatefulEventHandler(name, eventProvider, handlingLogic) {
        var _this = this;
        _super.call(this, name);

        // als handler für ein command registieren
        eventProvider.handle(function (params, state) {
            // was passieren soll, wenn das Event ausgelöst wurde
            handlingLogic(params, state); // die Business Logik für das Event ausführen
            _this.emit(params, state); // das Event an die hanlder (z.B. Projections) senden, die sich für das Event interessiern
        });
    }
    return StatefulEventHandler;
})(StatefulEventProvider);
exports.StatefulEventHandler = StatefulEventHandler;

///////////////////
// Domain Events
/// Domain Events are stored
var DomainEvent = (function (_super) {
    __extends(DomainEvent, _super);
    function DomainEvent(name, collectionName, db) {
        _super.call(this, name, collectionName, db);
    }
    return DomainEvent;
})(StatefulStoredEventProvider);
exports.DomainEvent = DomainEvent;

/// Command aren't stored
var Command = (function (_super) {
    __extends(Command, _super);
    function Command(name) {
        _super.call(this, name);
    }
    return Command;
})(StatefulEventProvider);
exports.Command = Command;

////////////////////
// Aggregation
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
                delete params._id; // assure _id is created by the database
                return Q.ninvoke(self.collection, 'insert', params);
            },
            update: function (query, params) {
                //        delete params._id;  // assure _id is created by the database
                return Q.ninvoke(self.collection, 'update', query, params);
            },
            remove: function (query) {
                return Q.ninvoke(self.collection, 'remove', query);
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
    return Context;
})();
exports.Context = Context;
//# sourceMappingURL=cqrs.js.map
