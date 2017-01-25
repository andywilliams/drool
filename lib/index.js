var webdriver = require('selenium-webdriver');
var chrome = require('selenium-webdriver/chrome');
var controlFlow = webdriver.promise.controlFlow();
var driverErrorMessage = 'Please provide a driver (as returned' +
' by drool.start) as the second argument to drool.flow';

function executeInFlow(fn) {
  if (typeof fn === 'function') {
    return controlFlow.execute(fn);
  }

  return controlFlow.execute(function() {});
}

function wait(duration) {
  return new Promise((resolve, reject) => {
    setTimeout(resolve, duration);
  });
}

function getFirstCounts(driver) {
  return driver.executeScript("gc()")
    .then(() => wait(10000))
    .then(() => getCounts(driver));
}

function getCounts(driver) {
  return driver.manage().logs().get("performance")
    .then(v => {
      var d = v.filter(function(v) {
        return JSON.parse(v.message).message.params.name === 'UpdateCounters';
      }).pop();

      return JSON.parse(d.message).message.params.args.data;
    });
}

function repeatFunction(action, count) {
  if (count === 0) {
    return Promise.resolve();
  }

  return action().then(function() {
    return repeatFunction(action, count - 1);
  });
}

function flow(set, driver) {
  var initial;
  if (!driver) { throw new Error(driverErrorMessage); }
  set.repeatCount = (typeof set.repeatCount === 'undefined') ? 5 : set.repeatCount;

  return set.setup()
    .then(() => getFirstCounts(driver))
    .then(d => {
      initial = d;
    })
    .then(() => {
      return repeatFunction(set.action, set.repeatCount)
    })
    .then(() => getCounts(driver))
    .then(d => {
      set.assert(d, initial);
    });
}

function start(opts) {
  opts = opts || {};

  var options = new chrome.Options();

  if (typeof opts.chromeBinaryPath !== 'undefined') {
    options.setChromeBinaryPath(opts.chromeBinaryPath);
  }

  ['--js-flags=--expose-gc'].concat(opts.chromeOptions || []).forEach(function(v) {
    options.addArguments(v);
  });

  options.setLoggingPrefs({performance: 'ALL'});
  options.setPerfLoggingPrefs({
    'traceCategories': 'v8,blink.console,disabled-by-default-devtools.timeline'
    //jscs:disable
    //Fix found here https://github.com/cabbiepete/browser-perf/commit/046f65f02db418c17ec2d59c43abcc0de642a60f
    // related to bug https://code.google.com/p/chromium/issues/detail?can=2&start=0&num=100&q=&colspec=ID%20Pri%20M%20Week%20ReleaseBlock%20Cr%20Status%20Owner%20Summary%20OS%20Modified&groupby=&sort=&id=474667
    //enableTimeline: true
    //jscs:enable
  });

  return new webdriver.Builder()
  .forBrowser('chrome')
  .setChromeOptions(options)
  .build();
}

module.exports = {
  start: start,
  flow: flow,
  getCounts: getCounts,
  webdriver: webdriver
};
