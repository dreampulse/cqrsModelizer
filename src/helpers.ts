/// <reference path="../typings/tsd.d.ts"/>

import mongodb = require('mongodb');
import express = require('express');
import Joi = require('joi');
import Q = require('q');
Q.longStackSupport = true;

import cqrs = require('./cqrs');

export interface DefaultDoc extends cqrs.ObjId {
  owner : mongodb.ObjectID;
//_id (inherited)
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
