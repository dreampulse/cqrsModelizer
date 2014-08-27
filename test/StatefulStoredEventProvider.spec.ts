/// <reference path="../typings/tsd.d.ts" />

import assert = require("assert");
import mongodb = require('mongodb');
import Q = require('q');
Q.longStackSupport = true;

import cqrs = require("../src/cqrs");


interface ExampleEvent {
  payload : string;
}

interface ExampleState {
  user : string;
}

var COLLECTION_NAME = "testMongoCollection";

describe("StatefulStoredEventProvider", () => {

  var myEventProvider : cqrs.StatefulStoredEventProvider<ExampleEvent, ExampleState>;
  var db : mongodb.Db;
  beforeEach((done) => {

    // init mongo connection
    Q.nfcall(mongodb.MongoClient.connect, 'mongodb://127.0.0.1:27017/testing')
      .then((_db:mongodb.Db) => {
        db = _db;

        myEventProvider = new cqrs.StatefulStoredEventProvider<ExampleEvent, ExampleState>("exampleEventName", COLLECTION_NAME, db);
        done();

      }).done();
  });

  afterEach((done) => {
    // delete collection after running
    Q.ninvoke(db.collection(COLLECTION_NAME), 'drop')
      .then(() => {
        done();
      }).done();
  });

  it("should store event in mongodb", (done) => {

    myEventProvider.emitQ({
      payload : "bar"
    }, {
      user : "test user"
    })
    .then(() => {  // was insert in db
      return Q.ninvoke(db.collection(COLLECTION_NAME).find({}), 'toArray');
    })
    .then((docs : any[]) => {

      // check event store
      assert.equal(docs.length, 1);
      assert.equal(docs[0].name, "exampleEventName");
      assert.deepEqual(docs[0].state, { user : "test user" });
      assert(docs[0].date < new Date());
      assert(docs[0]._id != undefined);

      done();
    }).done();

  });

});



