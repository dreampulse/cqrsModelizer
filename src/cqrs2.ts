/// <reference path="../typings/tsd.d.ts"/>

import mongodb = require('mongodb');
import Q = require('q');
Q.longStackSupport = true;


////////////////////////////
// Events

export class EventProvider<T> {

  constructor(public name : string) {}

  private eventHandlers : { [name:string] : (event:T) => void } = {};

  public handle(eventHandler : (event:T) => void) {
    this.eventHandlers[this.name] = eventHandler;
  }

  public emit(event:T) {
    for (var i in this.eventHandlers) {
      this.eventHandlers[i](event);
    }
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



///////////////////////
// Domain Events

// Ein Domain Event das bei einem best. Command ausgelöst wird
export class DomainEvent<T> extends EventProvider<T> {

  constructor(name:string, command:Command<T>, businessLogic:(params:T) => void) {
    super(name);

    // als handler für ein command registieren
    command.handle((params:T) => {
      // was passieren soll, wenn ein commando ausgelöst wurde

      businessLogic(params);  // die Business Logik für das Event ausführen
      this.emit(params); // das Event an die projections senden, die sich für das Event interessiern

    });
  }

}


/////////////////////
// Projections

export class MongoProjection<T> {
  private collection : mongodb.Collection;

  constructor(public name : string, db : mongodb.Db, projector:(thisProjection : MongoProjection<T>, collection : (mongoCmd : string, parm : T) => Q.Promise<void> ) => void) {

    this.collection = db.collection(name);

    var self = this;
    var collection = function(mongoCmd : string, parm : T) {
      return Q.ninvoke<void>(self.collection, mongoCmd, parm);  // invoke mongodb command
    };

    projector(this, collection);

  }

  public query(params : any) : Q.Promise<T[]> {
    return Q.ninvoke(this.collection.find(params), 'toArray').then((docs) => {
      return <T[]>docs;
    })
  }

}
