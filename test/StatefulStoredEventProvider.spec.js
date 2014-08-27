/// <reference path="../typings/tsd.d.ts" />
var assert = require("assert");
var mongodb = require('mongodb');
var Q = require('q');
Q.longStackSupport = true;

var cqrs = require("../src/cqrs");

var COLLECTION_NAME = "testMongoCollection";

describe("StatefulStoredEventProvider", function () {
    var myEventProvider;
    var db;
    beforeEach(function (done) {
        // init mongo connection
        Q.nfcall(mongodb.MongoClient.connect, 'mongodb://127.0.0.1:27017/testing').then(function (_db) {
            db = _db;

            myEventProvider = new cqrs.StatefulStoredEventProvider("exampleEventName", COLLECTION_NAME, db);
            done();
        }).done();
    });

    afterEach(function (done) {
        // delete collection after running
        Q.ninvoke(db.collection(COLLECTION_NAME), 'drop').then(function () {
            done();
        }).done();
    });

    it("should store event in mongodb", function (done) {
        myEventProvider.emitQ({
            payload: "bar"
        }, {
            user: "test user"
        }).then(function () {
            return Q.ninvoke(db.collection(COLLECTION_NAME).find({}), 'toArray');
        }).then(function (docs) {
            // check event store
            assert.equal(docs.length, 1);
            assert.equal(docs[0].name, "exampleEventName");
            assert.deepEqual(docs[0].state, { user: "test user" });
            assert(docs[0].date < new Date());
            assert(docs[0]._id != undefined);

            done();
        }).done();
    });
});
//# sourceMappingURL=StatefulStoredEventProvider.spec.js.map
