const CONFIG = require('./../config/config')

/**
 * This function will convert user into into the right contract of the Exchange
 * @param {string} string input command
 * @returns converted string
 */
function convertString(string) {
    return `${string.toUpperCase()}-PERP`;
}

function calculateProfit(entry, mark, side) {
    return (((side === 'buy' ? mark / entry : entry / mark) * 100) - 100).toFixed(3)
}

/**
 * Check if the incoming text === checkText
 * @param {string} incomingText 
 * @param {string} checkText 
 * @returns boolean
 */
function checkText(incomingText, checkText) {
    incomingText = incomingText.split(' ')[0];
    incomingText = incomingText.replace('/', '');
    return incomingText === checkText || incomingText === (`${checkText}${CONFIG.BOTNAME}`)
}

// Check if incomming alerts are already in the list
function containsPair(obj, list) {
    var i;
    for (i = 0; i < list.length; i++) {
        if (list[i].pair === obj.pair) {
            return true;
        }
    }

    return false;
}

module.exports = { convertString, checkText, calculateProfit, containsPair }