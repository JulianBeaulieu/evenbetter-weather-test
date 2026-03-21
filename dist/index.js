// EvenBetter Weather Test App
// A text-only weather app for Even G2 glasses.
// Fetches real weather data from Open-Meteo API.
// Works with the EvenBetter JS plugin system (no DOM dependencies).

(function() {
  'use strict';

  var sdk = require('@evenrealities/even_hub_sdk');

  // ---------------------------------------------------------------------------
  // Configuration
  // ---------------------------------------------------------------------------
  var DISPLAY_WIDTH = 640;
  var DISPLAY_HEIGHT = 400;

  // Default city (can be changed via localStorage)
  var DEFAULT_CITY = {
    name: 'New York',
    latitude: 40.7128,
    longitude: -74.0060
  };

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------
  var state = {
    screen: 0,       // 0=forecast, 1=now, 2=hourly
    startupDone: false,
    weather: null,
    city: DEFAULT_CITY
  };

  var SCREENS = ['forecast', 'now', 'hourly'];

  // ---------------------------------------------------------------------------
  // Weather API (Open-Meteo, free, no API key)
  // ---------------------------------------------------------------------------
  var WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  function wmoDescription(code) {
    if (code === 0) return 'Clear sky';
    if (code === 1) return 'Mainly clear';
    if (code === 2) return 'Partly cloudy';
    if (code === 3) return 'Overcast';
    if (code === 45 || code === 48) return 'Foggy';
    if (code >= 51 && code <= 57) return 'Drizzle';
    if (code >= 61 && code <= 67) return 'Rain';
    if (code >= 71 && code <= 77) return 'Snow';
    if (code >= 80 && code <= 82) return 'Showers';
    if (code >= 85 && code <= 86) return 'Snow showers';
    if (code >= 95) return 'Thunderstorm';
    return 'Unknown';
  }

  function windDirection(deg) {
    var dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    return dirs[Math.round(deg / 45) % 8];
  }

  function formatTime(iso) {
    var d = new Date(iso);
    var h = d.getHours();
    var m = d.getMinutes();
    return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
  }

  function fetchWeather(city) {
    var params = 'latitude=' + city.latitude +
      '&longitude=' + city.longitude +
      '&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m,surface_pressure' +
      '&hourly=temperature_2m,weather_code,precipitation_probability' +
      '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset' +
      '&timezone=auto&forecast_days=7';

    return fetch('https://api.open-meteo.com/v1/forecast?' + params)
      .then(function(res) {
        if (!res.ok) throw new Error('Fetch failed: ' + res.status);
        return res.json();
      })
      .then(function(data) {
        var current = data.current || {};
        var hourly = data.hourly || {};
        var daily = data.daily || {};

        var now = new Date();
        var hourlyTimes = hourly.time || [];
        var startIdx = 0;
        for (var i = 0; i < hourlyTimes.length; i++) {
          if (new Date(hourlyTimes[i]) >= now) { startIdx = i; break; }
        }

        var hours = [];
        for (var j = 0; j < 12 && (startIdx + j) < hourlyTimes.length; j++) {
          var idx = startIdx + j;
          hours.push({
            time: formatTime(hourlyTimes[idx]),
            temp: Math.round(hourly.temperature_2m[idx] || 0),
            wmo: hourly.weather_code[idx] || 0,
            precip: hourly.precipitation_probability[idx] || 0
          });
        }

        var days = [];
        var dailyTimes = daily.time || [];
        for (var k = 0; k < dailyTimes.length; k++) {
          days.push({
            day: k === 0 ? 'Today' : WEEKDAYS[new Date(dailyTimes[k] + 'T00:00:00').getDay()],
            wmo: daily.weather_code[k] || 0,
            max: Math.round(daily.temperature_2m_max[k] || 0),
            min: Math.round(daily.temperature_2m_min[k] || 0),
            precip: daily.precipitation_probability_max[k] || 0
          });
        }

        return {
          city: city.name,
          temp: Math.round(current.temperature_2m || 0),
          wmo: current.weather_code || 0,
          desc: wmoDescription(current.weather_code || 0),
          feelsLike: Math.round(current.apparent_temperature || 0),
          wind: Math.round(current.wind_speed_10m || 0),
          windDir: Math.round(current.wind_direction_10m || 0),
          humidity: Math.round(current.relative_humidity_2m || 0),
          pressure: Math.round(current.surface_pressure || 0),
          sunrise: daily.sunrise && daily.sunrise[0] ? formatTime(daily.sunrise[0]) : '',
          sunset: daily.sunset && daily.sunset[0] ? formatTime(daily.sunset[0]) : '',
          hours: hours,
          days: days
        };
      });
  }

  // ---------------------------------------------------------------------------
  // Screens (text-only, no DOM/canvas)
  // ---------------------------------------------------------------------------

  function forecastScreen(bridge, w) {
    var header = w.city + ' \u00B7 ' + w.temp + '\u00B0 \u00B7 ' + w.desc;

    var dayCol = w.days.map(function(d) { return d.day; }).join('\n');
    var tempCol = w.days.map(function(d) { return d.max + '\u00B0/' + d.min + '\u00B0'; }).join('\n');
    var condCol = w.days.map(function(d) {
      var cond = wmoDescription(d.wmo);
      if (cond.length > 12) cond = cond.substring(0, 12);
      var precip = d.precip > 0 ? ' ' + d.precip + '%' : '';
      return cond + precip;
    }).join('\n');

    var pageConfig = {
      containerTotalNum: 4,
      textObject: [
        new sdk.TextContainerProperty({
          containerID: 1, containerName: 'header',
          content: header,
          xPosition: 0, yPosition: 0,
          width: DISPLAY_WIDTH, height: 50,
          isEventCapture: 1, paddingLength: 6
        }),
        new sdk.TextContainerProperty({
          containerID: 2, containerName: 'days',
          content: dayCol,
          xPosition: 0, yPosition: 50,
          width: 120, height: 350,
          paddingLength: 6
        }),
        new sdk.TextContainerProperty({
          containerID: 3, containerName: 'temps',
          content: tempCol,
          xPosition: 120, yPosition: 50,
          width: 130, height: 350,
          paddingLength: 6
        }),
        new sdk.TextContainerProperty({
          containerID: 4, containerName: 'conds',
          content: condCol,
          xPosition: 250, yPosition: 50,
          width: 390, height: 350,
          paddingLength: 6
        })
      ]
    };

    if (!state.startupDone) {
      state.startupDone = true;
      return bridge.createStartUpPageContainer(new sdk.CreateStartUpPageContainer(pageConfig));
    }
    return bridge.rebuildPageContainer(new sdk.RebuildPageContainer(pageConfig));
  }

  function nowScreen(bridge, w) {
    var header = w.city + ' \u00B7 ' + w.temp + '\u00B0 \u00B7 ' + w.desc;
    var labels = 'Feels like\nWind\nHumidity\nPressure\n\nSunrise\nSunset';
    var values = w.feelsLike + '\u00B0\n' +
      w.wind + ' km/h ' + windDirection(w.windDir) + '\n' +
      w.humidity + '%\n' +
      w.pressure + ' hPa\n\n' +
      w.sunrise + '\n' +
      w.sunset;

    return bridge.rebuildPageContainer(new sdk.RebuildPageContainer({
      containerTotalNum: 3,
      textObject: [
        new sdk.TextContainerProperty({
          containerID: 1, containerName: 'header',
          content: header,
          xPosition: 0, yPosition: 0,
          width: DISPLAY_WIDTH, height: 50,
          isEventCapture: 1, paddingLength: 6
        }),
        new sdk.TextContainerProperty({
          containerID: 2, containerName: 'labels',
          content: labels,
          xPosition: 0, yPosition: 50,
          width: 160, height: 350,
          paddingLength: 6
        }),
        new sdk.TextContainerProperty({
          containerID: 3, containerName: 'values',
          content: values,
          xPosition: 160, yPosition: 50,
          width: 480, height: 350,
          paddingLength: 6
        })
      ]
    }));
  }

  function hourlyScreen(bridge, w) {
    var left = [];
    var right = [];
    for (var i = 0; i < w.hours.length; i++) {
      var h = w.hours[i];
      var label = i === 0 ? 'Now' : h.time;
      var cond = wmoDescription(h.wmo);
      if (cond.length > 10) cond = cond.substring(0, 10);
      var precip = h.precip > 0 ? ' ' + h.precip + '%' : '';
      var line = label + '  ' + h.temp + '\u00B0 ' + cond + precip;
      if (i < 6) { left.push(line); }
      else { right.push(line); }
    }

    return bridge.rebuildPageContainer(new sdk.RebuildPageContainer({
      containerTotalNum: 2,
      textObject: [
        new sdk.TextContainerProperty({
          containerID: 1, containerName: 'left',
          content: left.join('\n'),
          xPosition: 0, yPosition: 0,
          width: Math.floor(DISPLAY_WIDTH / 2), height: DISPLAY_HEIGHT,
          isEventCapture: 1, paddingLength: 6
        }),
        new sdk.TextContainerProperty({
          containerID: 2, containerName: 'right',
          content: right.join('\n'),
          xPosition: Math.floor(DISPLAY_WIDTH / 2), yPosition: 0,
          width: Math.floor(DISPLAY_WIDTH / 2), height: DISPLAY_HEIGHT,
          paddingLength: 6
        })
      ]
    }));
  }

  function showLoading(bridge) {
    var config = {
      containerTotalNum: 1,
      textObject: [
        new sdk.TextContainerProperty({
          containerID: 1, containerName: 'loading',
          content: 'Loading weather...',
          xPosition: 0, yPosition: 0,
          width: DISPLAY_WIDTH, height: DISPLAY_HEIGHT,
          isEventCapture: 1, paddingLength: 4
        })
      ]
    };
    if (!state.startupDone) {
      state.startupDone = true;
      return bridge.createStartUpPageContainer(new sdk.CreateStartUpPageContainer(config));
    }
    return bridge.rebuildPageContainer(new sdk.RebuildPageContainer(config));
  }

  function showScreen(bridge) {
    if (!state.weather) return showLoading(bridge);
    switch (state.screen) {
      case 0: return forecastScreen(bridge, state.weather);
      case 1: return nowScreen(bridge, state.weather);
      case 2: return hourlyScreen(bridge, state.weather);
      default: return forecastScreen(bridge, state.weather);
    }
  }

  // ---------------------------------------------------------------------------
  // Event handling
  // ---------------------------------------------------------------------------

  function resolveEventType(event) {
    var raw = null;
    if (event.listEvent) raw = event.listEvent.eventType;
    else if (event.textEvent) raw = event.textEvent.eventType;
    else if (event.sysEvent) raw = event.sysEvent.eventType;
    else if (event.type) {
      // Simplified format from EvenBetter bridge
      var t = String(event.type).toLowerCase();
      if (t === 'tap') return 0;
      if (t === 'double-tap') return 3;
      if (t === 'swipe-forward') return 1;
      if (t === 'swipe-backward') return 2;
    }
    if (typeof raw === 'number') return raw;
    return undefined;
  }

  // ---------------------------------------------------------------------------
  // Main
  // ---------------------------------------------------------------------------

  sdk.waitForEvenAppBridge().then(function(bridge) {
    console.log('Weather: connected to bridge');

    // Set up event handler
    bridge.onEvenHubEvent(function(event) {
      var eventType = resolveEventType(event);
      console.log('Weather: event type=' + eventType + ' screen=' + state.screen);

      switch (eventType) {
        case 1: // SCROLL_TOP = next screen
          state.screen = (state.screen + 1) % SCREENS.length;
          showScreen(bridge);
          break;
        case 2: // SCROLL_BOTTOM = prev screen
          state.screen = (state.screen - 1 + SCREENS.length) % SCREENS.length;
          showScreen(bridge);
          break;
        case 3: // DOUBLE_CLICK = refresh
          state.screen = 0;
          fetchWeather(state.city).then(function(w) {
            state.weather = w;
            showScreen(bridge);
          }).catch(function(err) {
            console.error('Weather: refresh failed', err);
          });
          break;
      }
    });

    // Initial load
    showLoading(bridge);
    fetchWeather(state.city).then(function(w) {
      state.weather = w;
      console.log('Weather: loaded for ' + w.city + ' - ' + w.temp + '\u00B0 ' + w.desc);
      showScreen(bridge);
    }).catch(function(err) {
      console.error('Weather: fetch failed', err);
    });

    // Auto-refresh every 15 minutes
    setInterval(function() {
      fetchWeather(state.city).then(function(w) {
        state.weather = w;
        showScreen(bridge);
      }).catch(function(err) {
        console.error('Weather: auto-refresh failed', err);
      });
    }, 15 * 60 * 1000);
  });
})();
