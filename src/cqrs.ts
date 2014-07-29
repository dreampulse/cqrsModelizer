/// <reference path="../typings/tsd.d.ts"/>

import Q = require('q');

import mongodb = require('mongodb');

Q.longStackSupport = true;

////////////////
///// Commands

class Command<T> {
  private eventHandler:(cmd:T) => Q.Promise<void>;

  public handle(eventHandler:(cmd:T) => Q.Promise<void>) {
    this.eventHandler = eventHandler;
  }

  public execute(params:T) : Q.Promise<void> {
    return this.eventHandler(params);
  }
}

////////////////////
// Storage of Domain Events

interface StoredEvent {
  name : string;
  eventCounter : number;
  params : any;
}

interface EventStore {
  save(event:StoredEvent) : Q.Promise<void>;
  restore() : Q.Promise<StoredEvent[]>;
  replay() : void;
  close() : void;

  eventCounter : number;
}

class LocalEventStore implements EventStore {
  private storage:StoredEvent[] = [];

  private domainEvents : { [name:string] : DomainEvent<any> } = {};

  public eventCounter : number;

  constructor(events : Array< DomainEvent<any> >) {

    // save reference to domain Event
    events.forEach((event) => {
      this.domainEvents[event.name] = event;
      event.store = this;
    });

  }

  public save(event:StoredEvent):Q.Promise<void> {
    this.storage.push(event);
    return Q<void>(null);
  }

  public restore() {
    return Q<StoredEvent[]>(this.storage);
  }

  public replay() {
    // replay events
    return this.restore()
      .then((events) => {
        events.forEach((event) => {
          // emitte das passende event
          this.domainEvents[event.name].emit(event.params);
        });
      });
  }


  public close() { }
}


class MongoEventStore implements EventStore {
  private db : mongodb.Db;
  private collection : mongodb.Collection;
  private initPromise : Q.Promise<void>;

  private domainEvents : { [name:string] : DomainEvent<any> } = {};

  public eventCounter : number = 0;

  constructor(events : Array< DomainEvent<any> >, private uri : string ) {

    // save reference to domain Event
    events.forEach((event) => {
      this.domainEvents[event.name] = event;
      event.store = this;
    });

    this.initPromise = Q.nfcall(mongodb.MongoClient.connect, this.uri)
      .then((db:any) => {
        this.db = db;
        this.collection = db.collection('events');
      })
      // todo eventCounter aus db hohlen

  }

  public close() {
    this.db.close();
  }

  public save(event:StoredEvent) : Q.Promise<void> {
    var defer = Q.defer<void>();

    event.eventCounter = this.eventCounter;
    this.eventCounter++;

    return this.initPromise.then(() => {
      return Q.ninvoke(this.collection, 'insert', event).then(() => {
      });
    });
  }

  public restore() : Q.Promise<StoredEvent[]> {
    return this.initPromise.then(() => {
      return Q.ninvoke(this.collection.find(), 'toArray').then((docs) => {
          return <StoredEvent[]>docs;
        })
    })
  }

  public replay() {
    // replay events
    return this.restore()
      .then((events) => {
        events.forEach((event) => {
          // emitte das passende event
          this.domainEvents[event.name].emit(event.params);
        });
      });
  }

}


///////////////////////
// Domain Events

class DomainEvent<T> {

  public store : EventStore;

  constructor(public name:string, command:Command<T>, businessLogic:(params:T) => Q.Promise<void>) {
    // handle a command
    command.handle((params:T) : Q.Promise<void> => {

      // Hinweis: reihenfolge ist wichtig - sonst kommen events doppel an..
      this.emit(params);                                  // den projections die sich für das Event interessiern benachrichtigen

      return this.store.save({name: name, params: params, eventCounter : -1})  // das Business Event speichern
        .then(() => {
          return businessLogic(params);                   // die Buiness Logic des DomainEvents ausführen
        })
    });
  }

  private projectionHandlers:Array< (cmd:T) => void > = [];

  // eine Projektion meldet sich für dieses Event an
  public handle(handler:(cmd:T) => void) {
    this.projectionHandlers.push(handler);  // projection handler subscriben
  }

  // den projections bescheid geben
  public emit(event:T) {
    this.projectionHandlers.forEach(handler => {
      handler(event);
    })
  }
}

/////////////////////
// Projections

class Projection<T> {
  public projection:T[] = [];

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



interface ActivityOwner {
  name : string;
  owner : number;
}


// .. client

var createActivityCommand = new Command<CreateActivity>();


var activityCreatedEvent = new DomainEvent<CreateActivity>(
  'activityCreatedEvent',
  createActivityCommand,
  (params) => {
    // business logic
    return Q<void>(null);
  }
);

var eventStore = new MongoEventStore([activityCreatedEvent], 'mongodb://127.0.0.1:27017/cqrs');
//var eventStore = new LocalEventStore([activityCreatedEvent]);

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


// ..

activityOwnerProjection.subscribe((view) => {
  console.log(view);
});


eventStore.replay()
  .then(() => {

    return createActivityCommand.execute({
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

  })
  .then(() => {
    console.log('current Projection', activityOwnerProjection.projection);
  })
  .then(() => {
    eventStore.close();
  }).done();
