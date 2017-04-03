const web3 = require("./chainConnector.js");
const chainApi = require("./chainApi.js");
const eth = web3.eth;
const etherex = web3.exchangeContract;
const co = require('co');
const chainUtil = require("./chainUtil.js");
const io = global.io;
const _ = require("lodash");
const db = require('../db');

// catch blockcreation events and broadcast them to all clients
let filter = eth.filter('latest');
filter.watch(function(err, res) {
    if (!_.isUndefined(res)) {
        chainApi.updateState();
        let startBlock = etherex.getStartBlock().toNumber();
        let minedBlocks = eth.blockNumber - startBlock;
        let toSend = { MinedBlocksInCurrPeriod: minedBlocks }
        io.emit('blockCreationEvent', JSON.stringify(toSend));
    }
});

// inserts the matching price into the database when the state changes to 1
var StateChangeEvent = etherex.StateChangedEvent();
StateChangeEvent.watch(function(err, res) {
    return co(function*() {
        if (!err) {
            if (!_.isUndefined(res)) {
                state = res.args._state.toNumber();
            }
            if (state === 1) {
                let matchingPrice = etherex.getMatchingPrice(chainUtil.getCurrentPeriod()).toNumber();
                let post = { period: chainUtil.getCurrentPeriod(), price: matchingPrice };

                try {
                    yield db.insertMatchingPrices(post);
                } catch (e) {
                    console.log(e);
                }

                // socket io
                io.emit('matchingEvent', JSON.stringify(post));
            } else {
                let post = { period: chainUtil.getCurrentPeriod() };

                // socket io
                io.emit('newPeriodEvent', JSON.stringify(post));
            }
        }
    });
});

// insert the reserveprice into the database when reservepriceevent comes in
var ReservePriceEvent = etherex.reservePriceEvent();
ReservePriceEvent.watch(function(err, res) {
    return co(function*() {
        if (!err) {
            let _price = res.args._price.toNumber();
            let _type = hex2a(res.args._type);
            let post = { period: chainUtil.getCurrentPeriod(), price: _price, type: _type };
            try {
                yield db.insertReservePrice(post);
            } catch (e) {
                console.log(e);
            }

            // socket io
            io.emit('reservePriceEvent', JSON.stringify(post));
        }
    });
});



// as soon as order gets submitted, it is saved in the database
var OrderEvent = etherex.OrderEvent();
OrderEvent.watch(function(err, res) {
    return co(function*() {
        if (!err) {
            let _price = res.args._price.toNumber();
            let _volume = res.args._volume.toNumber();
            let _period = chainUtil.getCurrentPeriod();
            let _type = hex2a(res.args._type);
            let post = { period: _period, price: _price, volume: _volume, type: _type };
            // socket io
            io.emit('orderEvent', JSON.stringify(post));
        }
    });
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

function sleep(time, callback) {
    var stop = new Date().getTime();
    while (new Date().getTime() < stop + time) {;
    }
    callback();
}

// function getAndSaveMatchingPriceHistory() {
//     for (let i = 0; i < currPeriod; i++) {
//         let res = etherex.getMatchingPrice(i).toNumber();
//         let post = { period: i, price: res };
//         let query = connection.query('insert ignore into matchingPrices set ?', post, function(err, res) {
//             if (err) {
//                 console.log("MySql error:", err);
//             }
//         });
//     }
// }