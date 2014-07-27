/// <reference path="../typings/tsd.d.ts"/>

import Q = require('q');


////////////////
///// Commands

class Command<T> {
  private eventHandler:(cmd:T) => void;

  public handle(eventHandler:(cmd:T) => void) {
    this.eventHandler = eventHandler;
  }

  public execute(params:T) {
    this.eventHandler(params);
  }
}

////////////////////
// Storage of Domain Events

interface StoredEvent<T> {
  name : string;
  params : T;
}

class Store<T> {
  private storage:StoredEvent<T>[] = [];

  public save(event:StoredEvent<T>):Q.Promise<void> {
    this.storage.push(event);
    return Q<void>(null);
  }

  public restore():Q.Promise< StoredEvent<T>[] > {
    return Q<StoredEvent<T>[]>(this.storage);
  }
}
///////////////////////
// Domain Events

class DomainEvent<T> {
  private eventStore:Store<T> = new Store<T>();

  constructor(public name:string, command:Command<T>, businessLogic:(params:T) => Q.Promise<void>) {
    // handle a command
    command.handle((params:T) => {

      // Hinweis: reihenfolge ist wichtig - sonst kommen events doppel an..
      this.emit(params);                                  // den projections die sich für das Event interessiern benachrichtigen

      this.eventStore.save({name: name, params: params})  // das Business Event speichern
        .then(() => {
          return businessLogic(params);                   // die Buiness Logic des DomainEvents ausführen
        })
        .done();

    });
  }

  private projectionHandlers:Array< (cmd:T) => void > = [];

  // eine Projektion meldet sich für dieses Event an
  public handle(handler:(cmd:T) => void) {

    // replay events
    this.eventStore.restore()
      .then((events) => {
        events.forEach((event) => {
          handler(event.params);
        });

        this.projectionHandlers.push(handler);  // projection handler subscriben
      }).done();
  }

  // den projections bescheid geben
  private emit(event:T) {
    this.projectionHandlers.forEach(handler => {
      handler(event);
    })
  }
}

/////////////////////
// Projections

class Projection<T> {
  private projection:T[] = [];

  private viewers:Array< (projection:T[]) => void > = [];

  constructor(projector:(projection:T[], notify:() => void) => void) {

    var self = this;
    var notify = function () {
      self.viewers.forEach((viewer) => {
        viewer(self.projection);
      })
    };

    projector(this.projection, notify);
  }

  public subscribe(subscriber:(projection:T[]) => void) {
    this.viewers.push(subscriber);
    subscriber(this.projection);  // nach dem subscribe direkt die aktuelle projection zurück geben
  }
}

interface Event {
  name : string;
  price : number;
  quantity : number;
}

interface CreateActivity {
  name : string;
  owner : string;
  events : Event[];
}

var createActivityCommand = new Command<CreateActivity>();


var activityCreatedEvent = new DomainEvent<CreateActivity>(
  'activityCreatedEvent',
  createActivityCommand,
  (params) => {
    // business logic
    return Q<void>(null);
  }
);



interface ActivityOwner {
  name : string;
  owner : number;
}

var activityOwnerProjection = new Projection<ActivityOwner>(
  (projection, notify) => {
    activityCreatedEvent.handle((a:CreateActivity) => {

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
    })
  });


// .. client

createActivityCommand.execute({
  name: "Nabada",
  owner: "Jonathan",
  events: [
    {
      name: "Schwörrede",
      price : 0,
      quantity : 10000
    },
    {
      name: "After Party",
      price : 7,
      quantity : 1000
    }
  ]
});

// ..

activityOwnerProjection.subscribe((view) => {
  console.log(view);
});
