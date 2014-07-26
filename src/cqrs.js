/// <reference path="../typings/tsd.d.ts"/>
var Command = (function () {
    function Command() {
        this.commandHandlers = [];
    }
    Command.prototype.handle = function (cmdHandler) {
        this.commandHandlers.push(cmdHandler);
    };

    Command.prototype.emit = function (cmd) {
        this.commandHandlers.forEach(function (handler) {
            handler(cmd);
        });
    };
    return Command;
})();

var createActivityCommand = new Command();

var ActivityOwner = (function () {
    function ActivityOwner() {
    }
    return ActivityOwner;
})();

var ActivityOwnerProjection = (function () {
    function ActivityOwnerProjection() {
        var _this = this;
        this.projection = [];
        createActivityCommand.handle(function (a) {
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
createActivityCommand.emit({
    name: "Nabada",
    owner: "Jonathan",
    events: ["Schwörrede", "Afterparty"]
});

// ..
var myOwnerView = new ActivityOwnerProjection().projection;
//# sourceMappingURL=cqrs.js.map
