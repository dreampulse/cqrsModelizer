/// <reference path="../typings/tsd.d.ts"/>
//class Command<T> {
//    private commandHandlers : Array< (cmd:T) => void > = [];
//
//    public handle(cmdHandler: (cmd:T) => void ) {
//        this.commandHandlers.push(cmdHandler);
//    }
//
//    public emit(cmd:T) {
//        this.commandHandlers.forEach(handler => {
//            handler(cmd);
//        })
//    }
//}
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

// Domain Events
var DomainEvent = (function () {
    function DomainEvent(command, businessLogic) {
        var _this = this;
        this.projectionHandlers = [];
        command.handle(function (param) {
            businessLogic(param);
            _this.emit(param);
        });
    }
    DomainEvent.prototype.handle = function (handler) {
        this.projectionHandlers.push(handler);
    };

    DomainEvent.prototype.emit = function (event) {
        this.projectionHandlers.forEach(function (handler) {
            handler(event);
        });
    };
    return DomainEvent;
})();

var activityCreatedEvent = new DomainEvent(createActivityCommand, function (params) {
});

var ActivityOwner = (function () {
    function ActivityOwner() {
    }
    return ActivityOwner;
})();

var ActivityOwnerProjection = (function () {
    function ActivityOwnerProjection() {
        var _this = this;
        this.projection = [];
        activityCreatedEvent.handle(function (a) {
            var activityOwner = new ActivityOwner();
            activityOwner.name = a.name;

            if (a.owner == 'Jonathan') {
                activityOwner.owner = 1;
            }

            _this.projection.push(activityOwner);
        });
    }
    return ActivityOwnerProjection;
})();

// .. client
var myOwnerView = new ActivityOwnerProjection().projection;

createActivityCommand.execute({
    name: "Nabada",
    owner: "Jonathan",
    events: ["Schwörrede", "Afterparty"]
});

// ..
console.log(myOwnerView);
//# sourceMappingURL=cqrs.js.map
