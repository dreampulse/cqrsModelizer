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


class Command<T> {
    private eventHandler : (cmd:T) => void;

    public handle(eventHandler: (cmd:T) => void ) {
        this.eventHandler = eventHandler;
    }

    public execute(params:T) {
        return this.eventHandler(params);
    }
}

interface CreateActivity {
    name : string;
    owner : string;
    events : string[];
}

var createActivityCommand = new Command<CreateActivity>();


// Domain Events
class DomainEvent<T> {
    constructor(command : Command<T>, businessLogic : (param : T) => void) {
        command.handle( (param : T) => {
            businessLogic(param);
            this.emit(param);
        });
    }

    private projectionHandlers : Array< (cmd:T) => void > = [];

    public handle(handler: (cmd:T) => void ) {
        this.projectionHandlers.push(handler);
    }

    private emit(event:T) {
        this.projectionHandlers.forEach(handler => {
            handler(event);
        })
    }
}

var activityCreatedEvent = new DomainEvent<CreateActivity>(
    createActivityCommand,
    (params) => { // business logic

    }
);

class ActivityOwner {
    name : string;
    owner : number;
}

class ActivityOwnerProjection {
    projection : ActivityOwner[] = [];

    constructor() {
        activityCreatedEvent.handle( (a : CreateActivity) => {
            var activityOwner = new ActivityOwner();
            activityOwner.name = a.name;

            if (a.owner == 'Jonathan') {
                activityOwner.owner = 1;
            }

            this.projection.push(activityOwner);
        })
    }
}


// .. client

var myOwnerView = new ActivityOwnerProjection().projection;

createActivityCommand.execute({
    name : "Nabada",
    owner : "Jonathan",
    events : ["Schwörrede", "Afterparty"]
});

// ..



console.log(myOwnerView);