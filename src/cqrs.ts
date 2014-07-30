/// <reference path="../typings/tsd.d.ts"/>

import mongodb = require('mongodb');
import Q = require('q');
Q.longStackSupport = true;


////////////////
///// Commands

// Ein Command mit Parametern T
export class Command<T> {
  private eventHandler:(cmd:T) => void;

  constructor(public name:string) {}

  // ein DomainEvent-Handler kann sich zum handeln des Commands registieren
  public handle(eventHandler:(cmd:T) => void) {
    this.eventHandler = eventHandler;
  }

  // ein Command ausführen
  public execute(params:T) {
    return this.eventHandler(params);
  }
}



///////////////////////
// Domain Events

// Ein Domain Event das bei einem best. Command ausgelöst wird
export class DomainEvent<T> {

  constructor(public name:string, command:Command<T>, businessLogic:(params:T) => void) {

    // als handler für ein command registieren
    command.handle((params:T) => {
      // was passieren soll, wenn ein commando ausgelöst wurde

      businessLogic(params);  // die Business Logik für das Event ausführen
      this.emit(params); // das Event an die projections senden, die sich für das Event interessiern

    });
  }

  // Hash [projectionName] => Projection Function
  private projectionHandlers: { [name:string] : (parms:T) => void } = {};

  // ein Projection-Handler meldet sich für dieses Event an
  public handle(projection : MongoProjection<any>, handler:(params:T) => void) {
    this.projectionHandlers[projection.name] = handler;  // projection handler subscriben
  }

  // allen projections die sich für dieses Event interessieren bescheid geben
  public emit(event:T) {
    for (var i in this.projectionHandlers) {
      this.projectionHandlers[i](event);
    }
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
