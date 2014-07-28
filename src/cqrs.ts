/// <reference path="../typings/tsd.d.ts"/>

import Q = require('q');

import mongodb = require('mongodb');

Q.longStackSupport = true;

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

interface StoredEvent {
  name : string;
  params : any;
}

class LocalEventStore {
  private storage:StoredEvent[] = [];

  public save(event:StoredEvent):Q.Promise<void> {
    this.storage.push(event);
    return Q<void>(null);
  }

  public restore() {
    return Q<StoredEvent[]>(this.storage);
  }
}


class MongoEventStore {
  private db : mongodb.Db;
  private collection : mongodb.Collection;

  public initPromise : Q.Promise<void>;

  constructor(public uri : string) {

    this.initPromise = Q.nfcall(mongodb.MongoClient.connect, this.uri)
      .then((db:any) => {
        this.db = db;
        this.collection = db.collection('events');
      });

  }

  public close() {
    this.db.close();
  }

  public save(event:StoredEvent) {
    var defer = Q.defer();

    this.initPromise.then(() => {
      this.collection.insert(event, function(err, doc) {
        if (err) {
          defer.reject(err);
          return;
        }
        defer.resolve(doc);
      });
    });

    return defer.promise;
//    return Q.nfcall(this.collection.insert, event);  // warum geht das hier nicht?!
  }

  public restore() : Q.Promise<StoredEvent[]> {
    var defer = Q.defer<StoredEvent[]>();

    this.initPromise.then(() => {
      this.collection.find().toArray(function (err, docs) {
        if (err) {
          defer.reject(err);
          return;
        }
        defer.resolve(<StoredEvent[]>docs);
      });
    });

    return defer.promise;

//    return Q.nfcall(this.collection.find().each)
//      .then((doc) => {
//        return <StoredEvent>doc;
//      })
  }

}

var eventStore = new MongoEventStore('mongodb://127.0.0.1:27017/cqrs');

///////////////////////
// Domain Events

class DomainEvent<T> {

  constructor(public name:string, command:Command<T>, businessLogic:(params:T) => Q.Promise<void>) {
    // handle a command
    command.handle((params:T) => {

      // Hinweis: reihenfolge ist wichtig - sonst kommen events doppel an..
      this.emit(params);                                  // den projections die sich für das Event interessiern benachrichtigen

      eventStore.save({name: name, params: params})  // das Business Event speichern
        .then(() => {
          return businessLogic(params);                   // die Buiness Logic des DomainEvents ausführen
        })
        .done();

    });
  }

  private projectionHandlers:Array< (cmd:T) => void > = [];

  // eine Projektion meldet sich für dieses Event an
  public handle(handler:(cmd:T) => void) {
    this.projectionHandlers.push(handler);  // projection handler subscriben
  }

  // den projections bescheid geben
  private emit(event:T) {
    this.projectionHandlers.forEach(handler => {
      handler(event);
    })
  }

  public replay() {
    // replay events
    return eventStore.restore()
      .then((events) => {
        events.forEach((event) => {
          if (event.name === this.name) {  // wenn das ein event von dem passenden typ ist
            this.emit(<T>event.params);
          }
        });
      });
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


activityCreatedEvent.replay()
.then(() => {
    eventStore.close();
  }).done();


//var lo_db;
//Q.nfcall(mongodb.MongoClient.connect, 'mongodb://127.0.0.1:27017/cqrs')
//  .then((db:any) => {
//    lo_db = db;
//  })
//  .then(() => {
//    var collection = lo_db.collection('test_insert');
//    collection.insert({a:2}, function(err, docs) {
//
//    collection.count(function(err, count) {
//      console.log("count", count);
//    });
//
//    // Locate all the entries using find
//    collection.find().toArray(function(err, results) {
//      console.dir(results);
//      // Let's close the db
//      lo_db.close();
//    });
//  });
//});
