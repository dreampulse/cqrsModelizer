/// <reference path="../typings/tsd.d.ts"/>


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

interface StoredEvent<T> {
    name : string;
    params : T;
}

class Store<T> {
    private storage : StoredEvent<T>[] = [];

    public save(event : StoredEvent<T>) {
        this.storage.push(event);
    }

    public restore() {
        return this.storage;
    }
}

// Domain Events
class DomainEvent<T> {
    private eventStore : Store<T> = new Store<T>();

    constructor(public name : string, command : Command<T>, businessLogic : (params : T) => void) {
        command.handle( (params : T) => {
            this.eventStore.save({name:name, params:params});
            businessLogic(params);
            this.emit(params);
        });
    }

    private projectionHandlers : Array< (cmd:T) => void > = [];

    public handle(handler: (cmd:T) => void ) {
        this.projectionHandlers.push(handler);

        // replay events
        this.eventStore.restore().forEach( (event) => {
            handler(event.params);
        });
    }

    private emit(event:T) {
        this.projectionHandlers.forEach(handler => {
            handler(event);
        })
    }
}

var activityCreatedEvent = new DomainEvent<CreateActivity>(
    'activityCreatedEvent',
    createActivityCommand,
    (params) => { // business logic

    }
);


class Projection<T> {
    private projection : T[]  = [];

    private viewers : Array< (projection : T[]) => void > = [];

    constructor( projector : (projection : T[], notify: () => void ) => void ) {

        var self = this;
        var notify = function() {
            self.viewers.forEach( (viewer) => {
                viewer(this.projection);
            })
        };

        projector(this.projection, notify);
    }

    public subscribe(subscriber: (projection : T[]) => void ) {
        this.viewers.push(subscriber);
        subscriber(this.projection);
    }
}

interface ActivityOwner {
    name : string;
    owner : number;
}

var activityOwnerProjection = new Projection<ActivityOwner>(
    (projection, notify) => {
        activityCreatedEvent.handle( (a : CreateActivity) => {

            // projection logic
            var owner = 0;
            if (a.owner == 'Jonathan') {
                owner = 1;
            }

            projection.push({
                name : a.name,
                owner: owner
            });
            notify();
        })
    });



// .. client

createActivityCommand.execute({
    name : "Nabada",
    owner : "Jonathan",
    events : ["Schwörrede", "Afterparty"]
});

// ..

activityOwnerProjection.subscribe((view) => {
    console.log(view);
});

