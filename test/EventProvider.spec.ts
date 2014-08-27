/// <reference path="../typings/tsd.d.ts" />

import assert = require("assert");

import cqrs = require("../src/cqrs");


interface ExampleEvent {
  payload : string;
}

describe("EventProvider", () => {

  var myEventProvider : cqrs.EventProvider<ExampleEvent>;
  beforeEach(() => {
    myEventProvider = new cqrs.EventProvider<ExampleEvent>("exampleEventName");
  });

  it("should emit and handle an event", () => {
    var wasHandeled = false;
    myEventProvider.handle((e : ExampleEvent) => {
      // handling the event
      assert.equal(e.payload, "bar");
      wasHandeled = true;
    });

    myEventProvider.emit({
      payload : "bar"
    });

    assert.equal(wasHandeled, true);
  });


  it("should handle an event multiple times", () => {

    var handler0 = false;
    myEventProvider.handle((e : ExampleEvent) => {
      handler0 = true;
    });

    var handler1 = false;
    myEventProvider.handle((e : ExampleEvent) => {
      handler1 = true;
    });


    myEventProvider.emit({
      payload : "bar"
    });

    assert.equal(handler0, true);
    assert.equal(handler1, true);
  });

});



