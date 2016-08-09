var APP_ID = undefined; //replace with "amzn1.echo-sdk-ams.app.[your-unique-value-here]";

var http = require('http');
var AlexaSkill = require('./AlexaSkill');

var MuniTimes = function () {
    AlexaSkill.call(this, APP_ID);
};

MuniTimes.prototype = Object.create(AlexaSkill.prototype);
MuniTimes.prototype.constructor = MuniTimes;

MuniTimes.prototype.eventHandlers.onSessionStarted = function (sessionStartedRequest, session) {
    console.log("MuniTimes onSessionStarted requestId: " + sessionStartedRequest.requestId
        + ", sessionId: " + session.sessionId);
};

MuniTimes.prototype.eventHandlers.onLaunch = function (launchRequest, session, response) {
    console.log("MuniTimes onLaunch requestId: " + launchRequest.requestId + ", sessionId: " + session.sessionId);
    handleMuniRequest(response);
};

MuniTimes.prototype.intentHandlers = {
    GetMuniTimesIntent: function (intent, session, response) {
		if (intent.slots.Type.value) { var intentType = intent.slots.Type.value } else { var intentType = '' } 
		if (intent.slots.Line.value) { var intentLine = intent.slots.Line.value } else { var intentLine = '' }
		if (intent.slots.Direction.value) { var intentDirection = intent.slots.Direction.value } else { var intentDirection = '' }
		handleMuniRequest(intentType,intentLine,intentDirection,response); 
    },
	
    HelpIntent: function (intent, session, response) {
        response.ask("You can ask Muni when the metro or bus is coming, or, you can say exit... What can I help you with?");
    }
};

function handleMuniRequest(type,line,direction,response) {
	switch(line){
		case "N":
			var stopId = "&stops=N|5240";
			var typeName = "outbound N metros";
			break;
		case "KT":
		case "K":
			switch(direction){
				case "outbound":
					var stopId = "&stops=KT|7166";
					var typeName = "outbound KT metros";
					break;
				default:
					var stopId = "&stops=KT|7397";
					var typeName = "inbound KT metros";
			}
			break;
		case "30":
			var stopId = "&stops=30|7235";
			var typeName = "outbound 30 busses";
			break;
		case "45":
			var stopId = "&stops=45|7235";
			var typeName = "outbound 45 busses";	
			break;
		case "10":
			var stopId = "&stops=10|6695";
			var typeName = "inbound 10 busses";	
			break;
		case "82":
		case "82X":
		case "82 express":
			var stopId = "&stops=82X|3164";
			var typeName = "inbound 82X busses";	
			break;	
		default:
			switch(type){
				case "bus":
				case "busses":
					var stopId = "&stops=30|7235&stops=45|7235";
					var typeName = "busses";
				break;	
				default:
					var stopId = "&stops=N|5240&stops=KT|7166";
					var typeName = "metros";						
			}	
	}


	makeNextMuniRequest("sf-muni", stopId, function nextMuniRequestCallback(err, nextMuniResponse) {
        var speechOutput;

        if (err) {
            speechOutput = "Sorry, the Next Muni service is experiencing a problem. Please try again later";
        } else {
			if (nextMuniResponse==""){
				speechOutput = "There is currently no service for the " + typeName;
			} else {
				speechOutput = "The next " + typeName + " are " + nextMuniResponse;
			}
        }

        //response.tellWithCard(speechOutput, "Muni", speechOutput)
		response.tell(speechOutput)
    });
}

/**
 * Uses NextMuni API, currently agency and stop ID are hardcoded.
 * Get agency name from: http://webservices.nextbus.com/service/publicXMLFeed?command=agencyList
 * For SF Muni, get stop ID from: http://www.nextbus.com/wirelessConfig/stopNumbers.jsp?a=sf-muni
 */
function makeNextMuniRequest(agency, stopId, nextMuniRequestCallback) {

    var endpoint = 'http://webservices.nextbus.com/service/publicXMLFeed';
	var queryString = '?command=predictionsForMultiStops&a='+ agency + stopId;

    http.get(endpoint + queryString, function (res) {
        var nextMuniResponseString = '';

        res.on('data', function (data) {
            nextMuniResponseString += data;
        });

        res.on('end', function () {
            var data = []
            var parseString = require('xml2js').parseString;
            var nextMuniResponseObject = parseString(nextMuniResponseString, function (err, result) {
                for(var i = 0; i < result.body.predictions.length; i++) {
                    var currPredictions = result.body.predictions[i];
                    if (currPredictions.direction != undefined) {
                        for (var j = 0; j < currPredictions.direction.length; j++) {
                            for (var k = 0; k < currPredictions.direction[j].prediction.length; k++) {
                                var dict = {};
                                dict["route"] = currPredictions.$.routeTag;
                                dict["minutes"] = Number(currPredictions.direction[j].prediction[k].$.minutes);
                                data[data.length] = dict;
                            }
                        }
                    }
                }

                // Sort by arrival times
                data.sort(function(a, b) {
                    if (a["minutes"] < b["minutes"]) return -1;
                    if (a["minutes"] > b["minutes"]) return 1;
                    return 0;
                });
            });

            if (nextMuniResponseObject.error) {
                console.log("NextMuni error: " + nextMuniResponseObject.error.message);
                nextMuniRequestCallback(new Error(nextMuniResponseObject.error.message));
            } else {
                nextMuniRequestCallback(null, convertDataToString(data));
            }
        });
    }).on('error', function (e) {
        console.log("Communications error: " + e.message);
        nextMuniRequestCallback(new Error(e.message));
    });
}

function convertDataToString(data) {
    var string = ""
    var n = Math.min(data.length, 3)
    for (var i = 0; i < n; i++) {
        string += data[i]["route"] + " in " + data[i]["minutes"] + (data[i]["minutes"] == 1 ? " minute" : " minutes")
        if (i < (n - 1)) {
            string += ", "
            if (i == (n - 2)) {
                string += "and "
            }
        } else {
            string += "."
        }
    }
    return string
}

exports.handler = function (event, context) {
    var busTimes = new MuniTimes();
    busTimes.execute(event, context);
};
