/// <reference path="../typings/tsd.d.ts" />

import assert = require("assert");

import cqrs = require("../src/cqrs");


interface ExampleEvent {
  payload : string;
}

interface ExampleState {
  user : string;
}

describe("StatefulEventProvider", () => {

  it("should emit and handle an event", () => {
    var myEventProvider = new cqrs.StatefulEventProvider<ExampleEvent, ExampleState>("exampleEventName");

    var wasHandeled = false;
    myEventProvider.handle((e : ExampleEvent, state : ExampleState) => {
      assert.equal(e.payload, "bar");
      assert.equal(state.user, "test user");

      wasHandeled = true;
    });

    myEventProvider.emit({
      payload : "bar"
    }, {
      user : 'test user'
    });

    assert.equal(wasHandeled, true);
  });

});



