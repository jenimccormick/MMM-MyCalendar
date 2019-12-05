// ---------------------------------------------------------- //
// MMM-MyCalendar.js
// ---------------------------------------------------------- //
Module.register("MMM-MyCalendar", {

    // ---------------------------------------------------------- //
    // Default module config
    // ---------------------------------------------------------- //
    defaults: {
        maximumEntries: 25, // Total Maximum Entries
        maximumNumberOfDays: 365,
        displaySymbol: true,
        defaultSymbol: "calendar", // Fontawesome Symbol see http://fontawesome.io/cheatsheet/
        showLocation: false,
        displayRepeatingCountTitle: false,
        defaultRepeatingCountTitle: "",
        maxTitleLength: 35,
        wrapEvents: false, // wrap events to multiple lines breaking at maxTitleLength
        maxTitleLines: 3,
        fetchInterval: 5 * 60 * 1000, // Update every 5 minutes.
        animationSpeed: 2000,
        fade: false,
        urgency: 7,
        timeFormat: "relative",
        dateFormat: "DD MMM",
        dateEndFormat: "LT",
        fullDayEventDateFormat: "DD MMM",
        showEnd: true,
        getRelative: 6,
        fadePoint: 0.25, // Start on 1/4th of the list.
        hidePrivate: false,
        hideOngoing: false,
        colored: true,
        coloredSymbolOnly: false,
        tableClass: "small",
        calendars: [
            {
                symbol: "calendar",
                url: "http://www.calendarlabs.com/templates/ical/US-Holidays.ics"
            }
        ],
        titleReplace: {
            "class level": "Class Level",
            "practitioner": "Practitioner"
        },
        broadcastEvents: true,
        excludedEvents: [],
        sliceMultiDayEvents: false,
        broadcastPastEvents: false,
        nextDaysRelative: false
    },

    // ---------------------------------------------------------- //
    // Define required scripts.
    // ---------------------------------------------------------- //
    getStyles: function () {

        return ["MMM-MyCalendar.css", "font-awesome.css"];

    },

    // ---------------------------------------------------------- //
    // Define required scripts.
    // ---------------------------------------------------------- //
    getScripts: function () {

        return ["moment.js"];

    },

    // ---------------------------------------------------------- //
    // Define required translations.
    // ---------------------------------------------------------- //
    getTranslations: function () {

        // The translations for the default modules are defined in the core translation files.
        // Therefore we can just return false. Otherwise we should have returned a dictionary.
        // If you're trying to build your own module including translations, check out the documentation.
        return false;

    },

    // ---------------------------------------------------------- //
    // Override start method.
    // ---------------------------------------------------------- //
    start: function () {

        Log.log("Starting module: '" + this.name + "'...");

        // set locale
        moment.updateLocale(config.language, this.getLocaleSpecification(config.timeFormat));

        for (var c in this.config.calendars) {

            var calendar = this.config.calendars[c];
            calendar.url = calendar.url.replace("webcal://", "http://");

            var calendarConfig = {
                maximumEntries: calendar.maximumEntries,
                maximumNumberOfDays: calendar.maximumNumberOfDays,
                broadcastPastEvents: calendar.broadcastPastEvents,
            };

            if (calendar.symbolClass === "undefined" || calendar.symbolClass === null) {
                calendarConfig.symbolClass = "";
            }
            if (calendar.titleClass === "undefined" || calendar.titleClass === null) {
                calendarConfig.titleClass = "";
            }
            if (calendar.timeClass === "undefined" || calendar.timeClass === null) {
                calendarConfig.timeClass = "";
            }

            // we check user and password here for backwards compatibility with old configs
            if (calendar.user && calendar.pass) {
                Log.warn("Deprecation warning: Please update your calendar authentication configuration.");
                Log.warn("https://github.com/MichMich/MagicMirror/tree/v2.1.2/modules/default/calendar#calendar-authentication-options");
                calendar.auth = {
                    user: calendar.user,
                    pass: calendar.pass
                };
            }

            this.addCalendar(calendar.url, calendar.auth, calendarConfig);

            // Trigger ADD_CALENDAR every fetchInterval to make sure there is always a calendar fetcher running on the server side.
            var self = this;
            setInterval(function () {
                self.addCalendar(calendar.url, calendar.auth, calendarConfig);
            }, self.config.fetchInterval);

        }

        this.calendarData = {};
        this.loaded = false;

    },

    // ---------------------------------------------------------- //
    // Override socket notification handler.
    // ---------------------------------------------------------- //
    socketNotificationReceived: function (notification, payload) {

        if (notification === "CALENDAR_EVENTS") {

            if (this.hasCalendarURL(payload.url)) {

                this.calendarData[payload.url] = payload.events;
                this.loaded = true;

                if (this.config.broadcastEvents) {
                    this.broadcastEvents();
                }

            }

        }
        else if (notification === "FETCH_ERROR") {
            Log.error("Calendar Error. Could not fetch calendar: " + payload.url);
            this.loaded = true;
        }
        else if (notification === "INCORRECT_URL") {
            Log.error("Calendar Error. Incorrect url: " + payload.url);
        }
        else {
            Log.log("Calendar received an unknown socket notification: " + notification);
        }

        this.updateDom(this.config.animationSpeed);

    },

    // ---------------------------------------------------------- //
    // Override DOM generator.
    // ---------------------------------------------------------- //
    getDom: function () {

        var events = this.createEventList();

        var oCalendarTable = document.createElement("table");
        oCalendarTable.className = this.config.tableClass;

        if (events.length === 0) {
            oCalendarTable.innerHTML = (this.loaded) ? this.translate("EMPTY") : this.translate("LOADING");
            oCalendarTable.className = this.config.tableClass + " dimmed";
            return oCalendarTable;
        }

        for (var iIndex in events) {

            var event = events[iIndex];

            // ---------------------------------------------------------- //
            // ROW: calendar entry
            // ---------------------------------------------------------- //
            var oEventRow = document.createElement("tr");
            oEventRow.className = "normal " + this.colorizeEventEntry(event.title);


            // ---------------------------------------------------------- //
            // CELL: include Calendar Entry Icon
            // ---------------------------------------------------------- //
            var oEventIconCell = document.createElement("td");
            oEventIconCell.className = "symbol align-right " + this.symbolClassForUrl(event.url);
			var oIconSpan = document.createElement("span");
			oIconSpan.className = "fa fa-fw fa-calendar";
			oEventIconCell.appendChild(oIconSpan);

            oEventRow.appendChild(oEventIconCell);


            // ---------------------------------------------------------- //
            // CELL: include Calendar Entry Date
            // ---------------------------------------------------------- //
            var oEventDateCell = document.createElement("td");
            oEventDateCell.className = "date";
            oEventDateCell.innerHTML = moment(event.startDate, "x").format(this.config.dateFormat);

            oEventRow.appendChild(oEventDateCell);


            // ---------------------------------------------------------- //
            // CELL: include Calendar Entry Time
            // ---------------------------------------------------------- //
            var oEventTimeCell = document.createElement("td");
            oEventTimeCell.className = "time";
            if (event.fullDayEvent) {
                oEventTimeCell.innerHTML = "All Day";
            }
            else {
                oEventTimeCell.innerHTML = moment(event.startDate, "x").format("LT");
            }

            oEventRow.appendChild(oEventTimeCell);


            // ---------------------------------------------------------- //
            // CELL: include Calendar Entry Title
            // ---------------------------------------------------------- //
            var oEventTitleCell = document.createElement("td");
            oEventTitleCell.className = "title";
            oEventTitleCell.innerHTML = this.titleTransform(event.title);

            oEventRow.appendChild(oEventTitleCell);


            oCalendarTable.appendChild(oEventRow);

        }

        return oCalendarTable;

    },

    // ---------------------------------------------------------- //
    /**
     * This function accepts a number (either 12 or 24) and returns a moment.js LocaleSpecification with the
     * corresponding timeformat to be used in the calendar display. If no number is given (or otherwise invalid input)
     * it will a localeSpecification object with the system locale time format.
     *
     * @param {number} timeFormat Specifies either 12 or 24 hour time format
     * @returns {moment.LocaleSpecification}
     */
    // ---------------------------------------------------------- //
    getLocaleSpecification: function (timeFormat) {

        switch (timeFormat) {

            case 12: {
                return { longDateFormat: { LT: "h:mm A" } };
            }
            case 24: {
                return { longDateFormat: { LT: "HH:mm" } };
            }
            default: {
                return { longDateFormat: { LT: moment.localeData().longDateFormat("LT") } };
            }

        }

    },

    // ---------------------------------------------------------- //
    /**
     * Check if this config contains the calendar url.
     *
     * @param url {string} - Url to look for.
     * @returns {bool} - Has calendar url
     */
    // ---------------------------------------------------------- //
    hasCalendarURL: function (url) {

        for (var c in this.config.calendars) {
            var calendar = this.config.calendars[c];
            if (calendar.url === url) {
                return true;
            }
        }

        return false;

    },

    // ---------------------------------------------------------- //
    /**
     * Creates the sorted list of all events.
     *
     * @returnS {array} - Array with events.
     */
    // ---------------------------------------------------------- //
    createEventList: function () {

        var events = [];
        var today = moment().startOf("day");
        var now = new Date();
        var future = moment().startOf("day").add(this.config.maximumNumberOfDays, "days").toDate();

        for (var c in this.calendarData) {

            var calendar = this.calendarData[c];

            for (var e in calendar) {

                var event = JSON.parse(JSON.stringify(calendar[e])); // clone object

                if (event.endDate < now) {
                    continue;
                }

                if (this.config.hidePrivate) {
                    if (event.class === "PRIVATE") {
                        // do not add the current event, skip it
                        continue;
                    }
                }

                if (this.config.hideOngoing) {
                    if (event.startDate < now) {
                        continue;
                    }
                }

                if (this.listContainsEvent(events, event)) {
                    continue;
                }

                event.url = c;
                event.today = event.startDate >= today && event.startDate < (today + 24 * 60 * 60 * 1000);

                /* if sliceMultiDayEvents is set to true, multiday events (events exceeding at least one midnight) are sliced into days,
                * otherwise, esp. in dateheaders mode it is not clear how long these events are.
                */
                var maxCount = Math.ceil(((event.endDate - 1) - moment(event.startDate, "x").endOf("day").format("x")) / (1000 * 60 * 60 * 24)) + 1;
                if (this.config.sliceMultiDayEvents && maxCount > 1) {

                    var splitEvents = [];
                    var midnight = moment(event.startDate, "x").clone().startOf("day").add(1, "day").format("x");
                    var count = 1;

                    while (event.endDate > midnight) {

                        var thisEvent = JSON.parse(JSON.stringify(event)); // clone object
                        thisEvent.today = thisEvent.startDate >= today && thisEvent.startDate < (today + 24 * 60 * 60 * 1000);
                        thisEvent.endDate = midnight;
                        thisEvent.title += " (" + count + "/" + maxCount + ")";
                        splitEvents.push(thisEvent);

                        event.startDate = midnight;
                        count += 1;
                        midnight = moment(midnight, "x").add(1, "day").format("x"); // next day

                    }

                    // Last day
                    event.title += " (" + count + "/" + maxCount + ")";
                    splitEvents.push(event);

                    for (event of splitEvents) {
                        if ((event.endDate > now) && (event.endDate <= future)) {
                            events.push(event);
                        }
                    }

                }
                else {

                    events.push(event);

                }

            }

        }

        events.sort(function (a, b) {
            return a.startDate - b.startDate;
        });

        return events.slice(0, this.config.maximumEntries);

    },

    // ---------------------------------------------------------- //
    //
    // ---------------------------------------------------------- //
    listContainsEvent: function (eventList, event) {

        for (var evt of eventList) {
            if (evt.title === event.title && parseInt(evt.startDate) === parseInt(event.startDate)) {
                return true;
            }
        }

        return false;

    },

    // ---------------------------------------------------------- //
    /**
     * Requests node helper to add calendar url.
     *
     * @param url {string} - Url to add.
     */
    // ---------------------------------------------------------- //
    addCalendar: function (url, auth, calendarConfig) {

        this.sendSocketNotification("ADD_CALENDAR", {
            url: url,
            excludedEvents: calendarConfig.excludedEvents || this.config.excludedEvents,
            maximumEntries: calendarConfig.maximumEntries || this.config.maximumEntries,
            maximumNumberOfDays: calendarConfig.maximumNumberOfDays || this.config.maximumNumberOfDays,
            fetchInterval: this.config.fetchInterval,
            symbolClass: calendarConfig.symbolClass,
            titleClass: calendarConfig.titleClass,
            timeClass: calendarConfig.timeClass,
            auth: auth,
            broadcastPastEvents: calendarConfig.broadcastPastEvents || this.config.broadcastPastEvents,
        });

    },

    // ---------------------------------------------------------- //
    /**
     * Retrieves the symbols for a specific url.
     *
     * @param url {string} - Url to look for.
     * @returns {string}/{array} - The Symbols
     */
    // ---------------------------------------------------------- //
    symbolsForUrl: function (url) {

        return this.getCalendarProperty(url, "symbol", this.config.defaultSymbol);

    },

    // ---------------------------------------------------------- //
    /**
     * Retrieves the symbolClass for a specific url.
     *
     * @param url {string} - Url to look for.
     * @returns {string}
     */
    // ---------------------------------------------------------- //
    symbolClassForUrl: function (url) {

        return this.getCalendarProperty(url, "symbolClass", "");

    },

	// ---------------------------------------------------------- //
    /**
     * Retrieves the Event Entry CSS classname.
     *
     * @param psEventTitle {string} - event title.
     * @returns {string}
     */
    // ---------------------------------------------------------- //
    colorizeEventEntry: function (psEventTitle) {

        if (psEventTitle.indexOf("Community Reiki Clinic") > -1) {
            return "event1";
        }
        else if (psEventTitle.indexOf("Reiki Clinic") > -1) {
            return "event2";
        }
        else if (psEventTitle.indexOf("Cancer Care Clinic") > -1) {
            return "event3";
        }
        else if (psEventTitle.indexOf("SSRC Meeting") > -1) {
            return "event4";
        }
        else if (psEventTitle.indexOf("Reiki Circle") > -1) {
            return "event5";
        }
        else {
            return "event0";
        }

    },

    // ---------------------------------------------------------- //
    /**
     * Retrieves the calendar name for a specific url.
     *
     * @param url {string} - Url to look for.
     * @returns {string} - The name of the calendar
     */
    // ---------------------------------------------------------- //
    calendarNameForUrl: function (url) {

        return this.getCalendarProperty(url, "name", "");

    },

    // ---------------------------------------------------------- //
    /**
     * Retrieves the color for a specific url.
     *
     * @param url {string} - Url to look for.
     * @returnS {string} - The Color
     */
    // ---------------------------------------------------------- //
    colorForUrl: function (url) {

        return this.getCalendarProperty(url, "color", "#fff");

    },

    // ---------------------------------------------------------- //
    /**
     * Helper method to retrieve the property for a specific url.
     *
     * @param url {string} - Url to look for.
     * @param property {string} - Property to look for.
     * @param defaultValue {string} - Value if property is not found.
     * @returns {string} - The Property
     */
    // ---------------------------------------------------------- //
    getCalendarProperty: function (url, property, defaultValue) {

        for (var c in this.config.calendars) {
            var calendar = this.config.calendars[c];
            if (calendar.url === url && calendar.hasOwnProperty(property)) {
                return calendar[property];
            }
        }

        return defaultValue;

    },

    // ---------------------------------------------------------- //
    /**
     * Shortens a string if it's longer than maxLength and add a ellipsis to the end
     *
     * @param {string} string Text string to shorten
     * @param {number} maxLength The max length of the string
     * @param {boolean} wrapEvents Wrap the text after the line has reached maxLength
     * @param {number} maxTitleLines The max number of vertical lines before cutting event title
     * @returns {string} The shortened string
     */
    // ---------------------------------------------------------- //
    shorten: function (string, maxLength, wrapEvents, maxTitleLines) {

        if (typeof string !== "string") {
            return "";
        }

        if (wrapEvents === true) {

            var temp = "";
            var currentLine = "";
            var words = string.split(" ");
            var line = 0;

            for (var i = 0; i < words.length; i++) {

                var word = words[i];

                if (currentLine.length + word.length < (typeof maxLength === "number" ? maxLength : 25) - 1) { // max - 1 to account for a space

                    currentLine += (word + " ");

                }
                else {

                    line++;

                    if (line > maxTitleLines - 1) {
                        if (i < words.length) {
                            currentLine += "&hellip;";
                        }
                        break;
                    }

                    if (currentLine.length > 0) {
                        temp += (currentLine + "<br>" + word + " ");
                    }
                    else {
                        temp += (word + "<br>");
                    }

                    currentLine = "";

                }

            }

            return (temp + currentLine).trim();

        }
        else {

            if (maxLength && typeof maxLength === "number" && string.length > maxLength) {
                return string.trim().slice(0, maxLength) + "&hellip;";
            }
            else {
                return string.trim();
            }

        }

    },

    // ---------------------------------------------------------- //
    // @returns {string} Capitalize the first letter of a string
    // ---------------------------------------------------------- //
    capFirst: function (string) {

        return string.charAt(0).toUpperCase() + string.slice(1);

    },

    // ---------------------------------------------------------- //
    // Transforms the title of an event for usage.
    //
    // Replaces parts of the text as defined in config.titleReplace.
    // Shortens title based on config.maxTitleLength and config.wrapEvents
    //
    // @param title {string} The title to transform.
    // @returns {string} The transformed title.
    // ---------------------------------------------------------- //
    titleTransform: function (title) {

        for (var needle in this.config.titleReplace) {

            var replacement = this.config.titleReplace[needle];

            var regParts = needle.match(/^\/(.+)\/([gim]*)$/);
            if (regParts) {
                // the parsed pattern is a regexp.
                needle = new RegExp(regParts[1], regParts[2]);
            }

            title = title.replace(needle, replacement);

        }

        title = this.shorten(title, this.config.maxTitleLength, this.config.wrapEvents, this.config.maxTitleLines);

        return title;

    },

    // ---------------------------------------------------------- //
    // Broadcasts the events to all other modules for reuse.
    // The all events available in one array, sorted on startdate.
    // ---------------------------------------------------------- //
    broadcastEvents: function () {

        var eventList = [];

        for (var url in this.calendarData) {
            var calendar = this.calendarData[url];
            for (var e in calendar) {
                var event = cloneObject(calendar[e]);
                event.symbol = this.symbolsForUrl(url);
                event.calendarName = this.calendarNameForUrl(url);
                event.color = this.colorForUrl(url);
                delete event.url;
                eventList.push(event);
            }
        }

        eventList.sort(function (a, b) {
            return a.startDate - b.startDate;
        });

        this.sendNotification("CALENDAR_EVENTS", eventList);

    }

});
