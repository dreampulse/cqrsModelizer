/// <reference path="../typings/tsd.d.ts" />
var assert = require("assert");

var cqrs = require("../src/cqrs");

describe("EventProvider", function () {
    var myEventProvider;
    beforeEach(function () {
        myEventProvider = new cqrs.EventProvider("exampleEventName");
    });

    it("should emit and handle an event", function () {
        var wasHandeled = false;
        myEventProvider.handle(function (e) {
            // handling the event
            assert.equal(e.payload, "bar");
            wasHandeled = true;
        });

        myEventProvider.emit({
            payload: "bar"
        });

        assert.equal(wasHandeled, true);
    });

    it("should handle an event multiple times", function () {
        var handler0 = false;
        myEventProvider.handle(function (e) {
            handler0 = true;
        });

        var handler1 = false;
        myEventProvider.handle(function (e) {
            handler1 = true;
        });

        myEventProvider.emit({
            payload: "bar"
        });

        assert.equal(handler0, true);
        assert.equal(handler1, true);
    });
});
//# sourceMappingURL=EventProvider.spec.js.map
