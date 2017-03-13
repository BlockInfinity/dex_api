const web3 = require("./chainConnector.js");
const mysql = require("mysql");
const eth = web3.eth;
const etherex = web3.exchangeContract;

var currPeriod = etherex.getCurrPeriod().toNumber();
var state = etherex.getCurrState().toNumber();

var connection = mysql.createConnection({
    host: "localhost",
    user: "dex",
    password: "amalien",
    database: "apidb"
});

// inserts the matching price into the database when the state changes to 1
var StateChangeEvent = etherex.StateChangedEvent();
StateChangeEvent.watch(function(err, res) {
    if (!err) {
        state = res.args._state.toNumber();
        if (state == 1) {

            let matchingPrice = etherex.getMatchingPrice(currPeriod).toNumber();

            let post = { period: currPeriod, price: matchingPrice };
            let query = connection.query('insert ignore into matchingPrices set ?', post, function(err, res) {
                if (err) {
                    console.log("MySql error:", err);
                }
            });
        } else {
            currPeriod = etherex.getCurrPeriod().toNumber();
        }
    }
});

// as soon as order gets submitted, it is saved in the database
var OrderEvent = etherex.OrderEvent();
OrderEvent.watch(function(err, res) {
    if (!err) {
        let _price = res.args._price.toNumber();
        let _volume = res.args._volume.toNumber();
        let _period = etherex.getCurrPeriod().toNumber();
        let _type = hex2a(res.args._type);

        let post = { period: _period, price: _price, volume: _volume, type: _type };
        let query = connection.query('insert ignore into orders set ?', post, function(err, res) {
            if (err) {
                console.log("MySql error:", err);
            }
        });
    }
});

// helper function to convert solidity's bytes32 to string
function hex2a(hexx) {
    var hex = hexx.toString(); //force conversion
    var str = '';
    for (var i = 2; i < hex.length; i += 2) {
        if (parseInt(hex.substr(i, 2)) != 0) {
            str += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
        }
    }
    return str;
}


getAndSaveMatchingPriceHistory();

function getAndSaveMatchingPriceHistory() {

    for (let i = 0; i < currPeriod; i++) {
        let res = etherex.getMatchingPrice(i).toNumber();
        let post = { period: i, price: res };
        let query = connection.query('insert ignore into matchingPrices set ?', post, function(err, res) {
            if (err) {
                console.log("MySql error:", err);
            }
        });
    }
}

function getPeriod() {
    return currPeriod;
}

function getState() {
    return state;
}

module.exports = {
    getPeriod: getPeriod,
    getState: getState
}