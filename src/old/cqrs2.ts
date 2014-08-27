/// <reference path="../../typings/tsd.d.ts"/>

import mongodb = require('mongodb');
import Q = require('q');
Q.longStackSupport = true;


////////////////////////////
// Events

export class EventProvider<T> {

  constructor(public name : string) {}

  eventHandlers : { [name:string] : (event:T) => void } = {};

  public handle(eventHandler : (event:T) => void) {
    this.eventHandlers[this.name] = eventHandler;
  }

  public emit(event:T) {
    for (var i in this.eventHandlers) {
      this.eventHandlers[i](event);
    }
  }
}


///////////////////////
// Event Handler

// Handelt Events (HanldingLogic) und löst neue Events aus
export class EventHandler<T> extends EventProvider<T> {

  constructor(name:string, eventProvider:EventProvider<T>, handlingLogic:(params:T) => void) {
    super(name);

    // als handler für ein command registieren
    eventProvider.handle((params:T) => {
      // was passieren soll, wenn das Event ausgelöst wurde

      handlingLogic(params);  // die Business Logik für das Event ausführen
      this.emit(params); // das Event an die hanlder (z.B. Projections) senden, die sich für das Event interessiern

    });
  }

}


////////////////
///// Event Store
export class StoredEventProvider<T> extends EventProvider<T> {
  private collection : mongodb.Collection;

  constructor(name:string, collectionName : string, db : mongodb.Db) {
    super(name);

    this.collection = db.collection(collectionName);
  }

  public emit(event:T) {
    Q.ninvoke<void>(this.collection, 'insert', event);  // save Event to db
    super.emit(event);
  }
}


////////////////
///// Commands

// Ein Command mit Parametern T
export class Command<T> extends EventProvider<T> {

  constructor(name:string) {
    super(name);
  }

}


/////////////////////
// Projections

export interface Collection<T> {
  execute(mongoCmd : string, ...parms : any[]) : Q.Promise<void>;
  insert(params:T) : Q.Promise<void> ;
//  update(query :any, params:T);
//  delete(query :any);
}

export class MongoProjection<T> {
  private collection : mongodb.Collection;

  constructor(public name : string, db : mongodb.Db, projector:(collection : Collection<T>) => void) {

    this.collection = db.collection(name);

    var self = this;
    var collection : Collection<T> = {
      execute : function(mongoCmd : string, ...parms : any[]) {
        return Q.npost<void>(self.collection, mongoCmd, parms);  // invoke mongodb command
      },
      insert : function(params:T) {
        return Q.ninvoke<void>(self.collection, 'insert', params);
      }
    };

    projector(collection);

  }

  public query(params : any) : Q.Promise<T[]> {
    return Q.ninvoke(this.collection.find(params), 'toArray').then((docs) => {
      return <T[]>docs;
    })
  }

}



/////////////////////////////
// Context

export class Context {
  constructor(public name : string, public db : mongodb.Db) {}

  createCommand<T>(cmdName : string) : StoredEventProvider<T> {
    return new StoredEventProvider<T>(cmdName, this.name + 'Events', this.db);
  }

  createDomainEvent<T>(name:string, eventProvider:EventProvider<T>, handlingLogic:(params:T) => void) : EventHandler<T> {
    return new EventHandler<T>(name, eventProvider, handlingLogic);
  }
}

