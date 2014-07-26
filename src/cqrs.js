/// <reference path="../typings/tsd.d.ts"/>
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

var createActivityCommand = new Command();

var Store = (function () {
    function Store() {
        this.storage = [];
    }
    Store.prototype.save = function (event) {
        this.storage.push(event);
    };

    Store.prototype.restore = function () {
        return this.storage;
    };
    return Store;
})();

// Domain Events
var DomainEvent = (function () {
    function DomainEvent(name, command, businessLogic) {
        var _this = this;
        this.name = name;
        this.eventStore = new Store();
        this.projectionHandlers = [];
        command.handle(function (params) {
            _this.eventStore.save({ name: name, params: params });
            businessLogic(params);
            _this.emit(params);
        });
    }
    DomainEvent.prototype.handle = function (handler) {
        this.projectionHandlers.push(handler);

        // replay events
        this.eventStore.restore().forEach(function (event) {
            handler(event.params);
        });
    };

    DomainEvent.prototype.emit = function (event) {
        this.projectionHandlers.forEach(function (handler) {
            handler(event);
        });
    };
    return DomainEvent;
})();

var activityCreatedEvent = new DomainEvent('activityCreatedEvent', createActivityCommand, function (params) {
});

var Projection = (function () {
    function Projection(projector) {
        this.projection = [];
        this.viewers = [];
        var self = this;
        var notify = function () {
            var _this = this;
            self.viewers.forEach(function (viewer) {
                viewer(_this.projection);
            });
        };

        projector(this.projection, notify);
    }
    Projection.prototype.subscribe = function (subscriber) {
        this.viewers.push(subscriber);
        subscriber(this.projection);
    };
    return Projection;
})();

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

// .. client
createActivityCommand.execute({
    name: "Nabada",
    owner: "Jonathan",
    events: ["Schwörrede", "Afterparty"]
});

// ..
activityOwnerProjection.subscribe(function (view) {
    console.log(view);
});
//# sourceMappingURL=cqrs.js.map
