/// <reference path="../../typings/tsd.d.ts"/>
var Q = require('q');
Q.longStackSupport = true;

////////////////
///// Commands
// Ein Command mit Parametern T
var Command = (function () {
    function Command(name) {
        this.name = name;
    }
    // ein DomainEvent-Handler kann sich zum handeln des Commands registieren
    Command.prototype.handle = function (eventHandler) {
        this.eventHandler = eventHandler;
    };

    // ein Command ausführen
    Command.prototype.execute = function (params) {
        return this.eventHandler(params);
    };
    return Command;
})();
exports.Command = Command;

///////////////////////
// Domain Events
// Ein Domain Event das bei einem best. Command ausgelöst wird
var DomainEvent = (function () {
    function DomainEvent(name, command, businessLogic) {
        var _this = this;
        this.name = name;
        // Hash [projectionName] => Projection Function
        this.projectionHandlers = {};
        // als handler für ein command registieren
        command.handle(function (params) {
            // was passieren soll, wenn ein commando ausgelöst wurde
            businessLogic(params); // die Business Logik für das Event ausführen
            _this.emit(params); // das Event an die projections senden, die sich für das Event interessiern
        });
    }
    // ein Projection-Handler meldet sich für dieses Event an
    DomainEvent.prototype.handle = function (projection, handler) {
        this.projectionHandlers[projection.name] = handler; // projection handler subscriben
    };

    // allen projections die sich für dieses Event interessieren bescheid geben
    DomainEvent.prototype.emit = function (event) {
        for (var i in this.projectionHandlers) {
            this.projectionHandlers[i](event);
        }
    };
    return DomainEvent;
})();
exports.DomainEvent = DomainEvent;

/////////////////////
// Projections
var MongoProjection = (function () {
    function MongoProjection(name, db, projector) {
        this.name = name;
        this.collection = db.collection(name);

        var self = this;
        var collection = function (mongoCmd, parm) {
            return Q.ninvoke(self.collection, mongoCmd, parm);
        };

        projector(this, collection);
    }
    MongoProjection.prototype.query = function (params) {
        return Q.ninvoke(this.collection.find(params), 'toArray').then(function (docs) {
            return docs;
        });
    };
    return MongoProjection;
})();
exports.MongoProjection = MongoProjection;
//# sourceMappingURL=cqrs.js.map
