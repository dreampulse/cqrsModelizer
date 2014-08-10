/// <reference path="../typings/tsd.d.ts"/>

import mongodb = require('mongodb');
import express = require('express');
import Joi = require('joi');
import Q = require('q');
Q.longStackSupport = true;

import cqrs = require('./cqrs5');

export interface DefaultDoc extends cqrs.ObjId {
  owner : mongodb.ObjectID;
}

export class MongoCURDProjection<T extends DefaultDoc, S extends cqrs.ObjId> {

  private projection;

  constructor(public name:string, db : mongodb.Db,
              domainEventCreated : cqrs.DomainEvent<any, S>,
              domainEventUpdated : cqrs.DomainEvent<any, S>,
              domainEventDeleted : cqrs.DomainEvent<cqrs.ObjId, S>
    ) {

    this.projection = new cqrs.MongoProjection<T>(name, db, (collection) => {

      domainEventCreated.handle((eventParams:any, user:S) => {
        var doc = eventParams;
        doc.owner = user._id;

        collection.insert(doc);
      });

      domainEventUpdated.handle((eventParams:any, user:S) => {
        var doc = eventParams;
        doc.owner = user._id;

        collection.update({
          _id : doc._id,
          owner:user._id // only allow to change user documents
        }, doc);

      });

      domainEventDeleted.handle((objId:cqrs.ObjId, user:S) => {
        collection.remove({
          _id : objId._id,
          owner:user._id // only allow to change user documents
        });
      });

    });

  }

  public query(params : any) : Q.Promise<T[]> {
    return this.projection.query(params);
  }
}


export interface BasicRequestWithSession extends express.Request {
  session : {
    user : any;
  };
}

export var Resource = function<T>(app : express.Application, method : string, name : string, event : cqrs.DomainEvent<T, BasicRequestWithSession>, schema? : Joi.ObjectSchema) {

  app[method]('/' + name, (req:BasicRequestWithSession, res:express.Response) => {

    var params = <T>req.body;

    if (schema) Joi.assert(params, schema);

    event.emit(params, req.session.user);
    res.json({ok:true});
  });
};

