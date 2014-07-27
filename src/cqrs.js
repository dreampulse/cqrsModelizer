var Q = require('q');
var Command = (function () {
    function Command() {
    }
    Command.prototype.handle = function (eventHandler) {
        this.eventHandler = eventHandler;
    };
    Command.prototype.execute = function (params) {
        this.eventHandler(params);
    };
    return Command;
})();

var Store = (function () {
    function Store() {
        this.storage = [];
    }
    Store.prototype.save = function (event) {
        this.storage.push(event);
        return Q(null);
    };
    Store.prototype.restore = function () {
        return Q(this.storage);
    };
    return Store;
})();
var DomainEvent = (function () {
    function DomainEvent(name, command, businessLogic) {
        this.name = name;
        var _this = this;
        this.eventStore = new Store();
        this.projectionHandlers = [];
        command.handle(function (params) {
            _this.emit(params);
            _this.eventStore.save({ name: name, params: params }).then(function () {
                return businessLogic(params);
            }).done();
        });
    }
    DomainEvent.prototype.handle = function (handler) {
        var _this = this;
        this.eventStore.restore().then(function (events) {
            events.forEach(function (event) {
                handler(event.params);
            });
            _this.projectionHandlers.push(handler);
        }).done();
    };
    DomainEvent.prototype.emit = function (event) {
        this.projectionHandlers.forEach(function (handler) {
            handler(event);
        });
    };
    return DomainEvent;
})();
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
        subscriber(this.projection);
    };
    return Projection;
})();


var createActivityCommand = new Command();
var activityCreatedEvent = new DomainEvent('activityCreatedEvent', createActivityCommand, function (params) {
    return Q(null);
});

var activityOwnerProjection = new Projection(function (projection, notify) {
    activityCreatedEvent.handle(function (a) {
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
createActivityCommand.execute({
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
activityOwnerProjection.subscribe(function (view) {
    console.log(view);
});
//# sourceMappingURL=cqrs.js.map