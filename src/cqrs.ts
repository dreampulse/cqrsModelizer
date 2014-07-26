/// <reference path="../typings/tsd.d.ts"/>


class Command<T> {
    private commandHandlers : Array< (cmd:T) => void > = [];

    public handle(cmdHandler: (cmd:T) => void ) {
        this.commandHandlers.push(cmdHandler);
    }

    public emit(cmd:T) {
        this.commandHandlers.forEach(handler => {
            handler(cmd);
        })
    }
}

interface CreateActivity {
    name : string;
    owner : string;
    events : string[];
}

var createActivityCommand = new Command<CreateActivity>();


class ActivityOwner {
    name : string;
    owner : number;
}

class ActivityOwnerProjection {
    projection : ActivityOwner[] = [];

    constructor() {
        createActivityCommand.handle( (a : CreateActivity) => {
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

createActivityCommand.emit({
    name : "Nabada",
    owner : "Jonathan",
    events : ["Schwörrede", "Afterparty"]
});

// ..

var myOwnerView = new ActivityOwnerProjection().projection;