/// <reference path="../typings/tsd.d.ts"/>

import mongodb = require('mongodb');
import express = require('express');
import Q = require('q');
Q.longStackSupport = true;


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Event Providers


/**
 *  @EventProvider
 *  - you can emit an event of Type T
 *  - and register to handle this event
 */
export class EventProvider<T> {

  constructor(public name : string) {}

  eventHandlers : Array<(event:T) => void> = [];

  public handle(eventHandler : (event:T) => void) {
    this.eventHandlers.push(eventHandler);
  }

  public emit(event:T) {
    this.eventHandlers.forEach(handler => handler(event));
  }
}

/**
 *  @StatefulEventProvider
 *  same as a regular @EventProvider
 *  but you a parametrize the Event with a "State"
 */
export class StatefulEventProvider<T,S> {

  constructor(public name : string) {}

  eventHandlers : Array< (event:T, state:S) => void > = [];

  public handle(eventHandler : (event:T, state:S) => void) {
    this.eventHandlers.push(eventHandler);
  }

  public emit(event:T, state:S) {
    this.eventHandlers.forEach(handler => handler(event, state));
  }
}


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Stateful Event Providers

/**
 *  @StatefulStoredEventProvider
 *  same as @StatefulEventProvider
 *  but all events are stored when you @emit() an event to a MongoDB
 */
export class StatefulStoredEventProvider<T,S> extends StatefulEventProvider<T,S> {
  private collection : mongodb.Collection;

  constructor(name:string, collectionName : string, db : mongodb.Db) {
    super(name);

    this.collection = db.collection(collectionName);
  }

  public emit(event:T, state:S) {
    this.emitQ(event, state);
  }

  public emitQ(event:T, state:S) : Q.Promise<void> {
    var doc = {
      name : this.name,
      event : event,
      state : state,
      date : new Date()
    };
    super.emit(event, state);
    return Q.ninvoke<void>(this.collection, 'insert', doc);  // save Event to db
  }
}


/*  Not Needed  */
//export class StoredEventProvider<T> extends EventProvider<T> {
//  private collection : mongodb.Collection;
//
//  constructor(name:string, collectionName : string, db : mongodb.Db) {
//    super(name);
//
//    this.collection = db.collection(collectionName);
//  }
//
//  public emit(event:T) {
//    var doc = {
//      name : this.name,
//      event : event,
//      date : new Date()
//    };
//    Q.ninvoke<void>(this.collection, 'insert', doc);  // save Event to db
//    super.emit(event);
//  }
//}



///////////////////////
// Event Handler

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


// Handelt Events (HanldingLogic) und löst neue Events aus
export class StatefulEventHandler<T,S> extends StatefulEventProvider<T,S> {

  constructor(name:string, eventProvider:StatefulEventProvider<T,S>, handlingLogic:(params:T, state:S) => void) {
    super(name);

    // als handler für ein command registieren
    eventProvider.handle((params:T, state:S) => {
      // was passieren soll, wenn das Event ausgelöst wurde

      handlingLogic(params, state);  // die Business Logik für das Event ausführen
      this.emit(params, state); // das Event an die hanlder (z.B. Projections) senden, die sich für das Event interessiern

    });
  }

}





///////////////////
// Domain Events

/// Domain Events are stored
export class DomainEvent<T,S> extends StatefulStoredEventProvider<T,S> {

  constructor(name:string, collectionName : string, db : mongodb.Db) {
    super(name, collectionName, db);
  }
}

/// Command aren't stored
export class Command<T,S> extends StatefulEventProvider<T,S> {

  constructor(name:string) {
    super(name);
  }
}

////////////////////
// Aggregation

export class Aggregate<T> extends EventProvider<T> {

  constructor(name:string, aggregator : (emit : (params:T) => void) => void) {
    super(name);

    var self = this;
    var emit = function(params : T) : void {
      self.emit(params);
    };

    aggregator(emit);
  }

}


/* not needed */
//export class StoredAggregate<T> extends StoredEventProvider<T> {
//
//  constructor(name:string, collectionName : string, db : mongodb.Db, aggregator : (emit : (params:T) => void) => void) {
//    super(name, collectionName, db);
//
//    var self = this;
//    var emit = function(params : T) : void {
//      self.emit(params);
//    };
//
//    aggregator(emit);
//  }
//
//}


/////////////////////
// Projections

export interface Collection<T> {
  execute(mongoCmd : string, ...parms : any[]) : Q.Promise<void>;
  insert(params:T) : Q.Promise<void> ;
  update(query :any, params:T);
  remove(query :any);
}

export interface ObjId {
  _id : mongodb.ObjectID;
}

export class MongoProjection<T extends ObjId> {
  private collection : mongodb.Collection;

  constructor(public name : string, db : mongodb.Db, projector:(collection : Collection<T>) => void) {

    this.collection = db.collection(name);

    var self = this;
    var collection : Collection<T> = {
      execute : function(mongoCmd : string, ...parms : any[]) {
        return Q.npost<void>(self.collection, mongoCmd, parms);  // invoke mongodb command
      },
      insert : function(params:T) {
        delete params._id;  // assure _id is created by the database
        return Q.ninvoke<void>(self.collection, 'insert', params);
      },
      update : function(query:any, params:T) {
//        delete params._id;  // assure _id is created by the database
        return Q.ninvoke<void>(self.collection, 'update', query, params);
      },
      remove : function(query : any) {
        return Q.ninvoke<void>(self.collection, 'remove', query);
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

//  createCommand<T>(cmdName : string) : StoredEventProvider<T> {
//    return new StoredEventProvider<T>(cmdName, this.name + 'Events', this.db);
//  }
//
//  domainEvent<T>(name:string) : DomainEvent<T> {
//    return new DomainEvent<T>(name, this.name, this.db);
//  }

}

