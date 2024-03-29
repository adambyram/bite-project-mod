// Copyright 2011 Google Inc. All Rights Reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/**
 * @fileoverview The BITE container provides an interface for easily
 * creating a new BITE console container on the screen. The console is
 * automatically resizable and draggable, and can optionally store its location
 * and position based on the consoleId. The root element of the container
 * may be accessed by bite.client.Container.root().
 *
 * @author ralphj@google.com (Julie Ralph)
 */


goog.provide('bite.ux.Container');

goog.require('Bite.Constants');
goog.require('bite.client.Templates.ux');
goog.require('bite.ux.Dragger');
goog.require('bite.ux.Resizer');
goog.require('common.dom.element');
goog.require('goog.Timer');
goog.require('goog.dom');
goog.require('goog.events');
goog.require('goog.events.EventHandler');
goog.require('goog.json');
goog.require('soy');



/**
 * Sets up a new BITE console container. The container is set up to be
 * resizable and draggable.
 * @param {string} server The URL to the current BITE server.
 * @param {string} consoleId A unique ID for the container element. This ID
 *     will be used as an element ID, so should be labeled with the BITE
 *     prefix such as 'bite-bugs-console-container'. The ID will also
 *     be used to store the location of the container in localStorage,
 *     if opt_savePosition is true.
 * @param {string} headerText The title of the console container.
 * @param {string=} opt_headerSubtext A subtitle for the console container.
 * @param {boolean=} opt_savePosition Whether or not the console should save
 *     its last position in localStorage. If the position is not saved, a new
 *     container will always be positioned at the default location defined
 *     in background.js.
 * @param {boolean=} opt_hideOnLoad Whether or not the console should begin
 *     as a hidden element.
 * @param {string=} opt_tooltip The optional tooltip of this dialog.
 * @param {string=} opt_link The optional link to a tutorial.
 * @constructor
 */
bite.ux.Container = function(server, consoleId, headerText,
                             opt_headerSubtext, opt_savePosition,
                             opt_hideOnLoad, opt_tooltip, opt_link) {
  /**
   * The id of the current console element.
   * @type {string}
   * @private
   */
  this.consoleId_ = consoleId;

  /**
   * Manages browser events created by the container.
   * @type {!goog.events.EventHandler}
   * @private
   */
  this.eventHandler_ = new goog.events.EventHandler(this);

  /**
   * A function to call when the container is closed.
   * @type {function()}
   * @private
   */
  this.closeCallback_ = goog.nullFunction;

  var headerSubtext = opt_headerSubtext || '';
  var tooltip = opt_tooltip || '';
  var link = opt_link || '';
  var rootFolder = chrome.extension.getURL('');
  var container = soy.renderAsElement(
      bite.client.Templates.ux.consoleContainer,
      {rootFolder: rootFolder,
       serverUrl: server,
       consoleId: this.consoleId_,
       headerText: headerText,
       headerSubtext: headerSubtext,
       tooltip: tooltip,
       link: link});

  /**
   * The root element of the bugs console.
   * @type {!Element}
   * @private
   */
  this.root_ = container;

  var content = goog.dom.getElementByClass(
      bite.ux.Container.Classes_.CONTENT, this.root_);
  if (!content) {
    throw Error(
        'The element ' + bite.ux.Container.Classes_.CONTENT +
        ' could not be found');
  }

  /**
   * The div holding the content.
   * @type {!Element}
   * @private
   */
  this.content_ = content;

  var infobar = goog.dom.getElementByClass(
      bite.ux.Container.Classes_.INFOBAR, this.root_);

  if (!infobar) {
    throw Error(
        'The element ' + bite.ux.Container.Classes_.INFOBAR +
        ' could not be found');
  }

  /**
   * The infobar element.
   * @type {!Element}
   * @private
   */
  this.infobar_ = infobar;

  goog.dom.appendChild(goog.dom.getDocument().body, this.root_);

  /**
   * A counter to keep track of the number of messages in the infobar.
   * @type {number}
   * @private
   */
  this.messageCounter_ = 0;

  var savePositionCallback = function() {};
  if (opt_savePosition) {
    savePositionCallback = goog.bind(this.setLastSizeAndPosition_, this);
  }

  /**
   * Resizer for the container.
   * @type {!bite.ux.Resizer}
   * @private
   */
  this.resizer_ = new bite.ux.Resizer(this.root_, savePositionCallback);

  // Used as the drag element for the container.
  var header = goog.dom.getElementByClass(bite.ux.Container.Classes_.HEADER,
                                          this.root_);
  var updateResizer = goog.bind(this.resizer_.recalculate, this.resizer_);
  var dragCallback = function() {
    updateResizer();
    savePositionCallback();
  };

  /**
   * Dragger for the container.
   * @type {!bite.ux.Dragger}
   * @private
   */
  this.dragger_ = new bite.ux.Dragger(this.root_,
      /** @type {!Element} */ (header), dragCallback);

  this.getSavedConsoleLocation_();

  if (!opt_hideOnLoad) {
    this.show();
  }

  var closeButton = goog.dom.getElementByClass(
      bite.ux.Container.Classes_.CLOSE_BUTTON, this.root_);
  this.eventHandler_.listen(
      closeButton, goog.events.EventType.CLICK, this.closeHandler_);
};


/**
 * Location information for the console.
 *
 * @typedef {{position: {x: number, y: number},
 *            size: {height: number, width: number}}}
 */
bite.ux.Container.Location;

/**
 * Key prefixs used to keep persistent information in local storage.
 * The console locationkey used for each console will have the consoleId
 * as its suffix. The key used for each message will have the messageId as its
 * suffix.
 * @enum {string}
 * @private
 */
bite.ux.Container.Keys_ = {
  CONSOLE_LOCATION: 'bite-client-background-console-location-',
  SHOWN_MESSAGES: 'bite-client-background-shown-messages-'
};


/**
 * Default location for a new console window.
 * @type {bite.ux.Container.Location}
 * @private
 */
bite.ux.Container.DEFAULT_CONSOLE_LOCATION_ =
    {position: {x: 10, y: 10},
     size: {height: 400, width: 450}};


/**
 * CSS class names used by the BITE container.
 * @enum {string}
 * @private
 */
bite.ux.Container.Classes_ = {
  CLOSE_BUTTON: 'bite-close-button',
  CONTENT: 'bite-console-content',
  HEADER: 'bite-header',
  HIDDEN: 'bite-hidden',
  INFOBAR: 'bite-console-infobar'
};


/**
 * Makes the console visible.
 */
bite.ux.Container.prototype.show = function() {
  goog.style.setStyle(this.root_, 'visibility', 'visible');
};


/**
 * Hides the console.
 */
bite.ux.Container.prototype.hide = function() {
  goog.style.setStyle(this.root_, 'visibility', 'hidden');
};


/**
 * Returns whether or not the console is currently visible.
 * @return {boolean} True if the console is visible.
 */
bite.ux.Container.prototype.isVisible = function() {
  return goog.style.getStyle(this.root_, 'visibility') == 'visible';
};


/**
 * Destroys the current console.
 */
bite.ux.Container.prototype.remove = function() {
  this.eventHandler_.removeAll();
  goog.dom.getDocument().body.removeChild(this.root_);
};


/**
 * Sets the content of the container.
 * @param {string} innerHtml The HTML string describing the content.
 */
bite.ux.Container.prototype.setContentFromHtml = function(innerHtml) {
  this.content_.innerHTML = innerHtml;
};


/**
 * Gets the content of the container.
 * @return {Element} The content element of the container.
 */
bite.ux.Container.prototype.getContentElement = function() {
  return this.content_;
};


/**
 * Sets the content of the container from an element.
 * @param {Element} element The element to set as the content.
 */
bite.ux.Container.prototype.setContentFromElement = function(element) {
  this.setContentFromHtml(element.innerHTML);
};


/**
 * Sets a callback to call when the close button is clicked. If this is called
 * more than once, earlier callbacks are ignored.
 * @param {function()} callback The callback.
 */
bite.ux.Container.prototype.setCloseCallback = function(callback) {
  this.closeCallback_ = callback;
};


/**
 * Displays a message in the infobar. When the user closes the message,
 * the Id will be stored in localStorage and any future calls to
 * showInfoMessageOnce will NOT display that message.
 * @param {string} id A unique string identifying the message.
 * @param {string} message The text of the message.
 */
bite.ux.Container.prototype.showInfoMessageOnce = function(id, message) {

  chrome.extension.sendRequest(
      {'action': Bite.Constants.HUD_ACTION.GET_LOCAL_STORAGE,
       'key': bite.ux.Container.Keys_.SHOWN_MESSAGES + id},
      goog.bind(this.showInfoMessageCallback_, this, message, id));
};


/**
 * Displays a message in the infobar. The message will persist until
 * the user closes it.
 * @param {string} message The text of the message.
 * @param {number=} opt_autoHideInterval The interval in seconds that the
 *     message should automatically go away.
 * @export
 */
bite.ux.Container.prototype.showInfoMessage = function(
    message, opt_autoHideInterval) {
  this.addInfobarMessage_(message, null, opt_autoHideInterval);
};


/**
 * Returns the root element of the container
 * @return {Element} The root element.
 */
bite.ux.Container.prototype.getRoot = function() {
  return this.root_;
};


/**
 * Hides the infobar.
 * @private
 */
bite.ux.Container.prototype.hideInfobar_ = function() {
  goog.dom.classes.add(this.infobar_, bite.ux.Container.Classes_.HIDDEN);
};


/**
 * Displays the infobar.
 * @private
 */
bite.ux.Container.prototype.showInfobar_ = function() {
  goog.dom.classes.remove(this.infobar_, bite.ux.Container.Classes_.HIDDEN);
};


/**
 * If a message has been shown, does nothing. Otherwise, displays it in
 * the infobar.
 * @param {string} message The text of the message.
 * @param {string} messageId The unique id for the message.
 * @param {?string} shown Null if the message has not been shown.
 * @private
 */
bite.ux.Container.prototype.showInfoMessageCallback_ = function(message,
                                                                    messageId,
                                                                    shown) {
  if (!shown) {
    this.addInfobarMessage_(message, messageId);
  }
};


/**
 * Adds a message to the list of currently displayed messages on the infobar.
 * @param {string} message The message to display.
 * @param {?string} messageId The id for this message.
 * @param {number=} opt_autoHideInterval The interval in seconds that the
 *     message should automatically go away.
 * @private
 */
bite.ux.Container.prototype.addInfobarMessage_ =
    function(message, messageId, opt_autoHideInterval) {
  if (this.messageCounter_ == 0) {
    this.showInfobar_();
  }
  ++this.messageCounter_;
  var messageElement = goog.dom.createDom(goog.dom.TagName.SPAN);
  messageElement.innerHTML = message;
  this.infobar_.appendChild(messageElement);

  var boundOnRemoveMessage = goog.bind(
      this.removeMessage_, this, messageElement, messageId);
  this.eventHandler_.listen(
      messageElement, goog.events.EventType.CLICK,
      boundOnRemoveMessage);
  if (opt_autoHideInterval) {
    goog.Timer.callOnce(
        boundOnRemoveMessage, opt_autoHideInterval * 1000);
  }
};


/**
 * Removes a specific infobar message from view. If the message has an id,
 * sets a value of 't' for that message in localStorage so it will not be
 * displayed again.
 *
 * @param {Element} messageElement The message to remove.
 * @param {?string} messageId The id of the message to remove.
 * @private
 */
bite.ux.Container.prototype.removeMessage_ =
    function(messageElement, messageId) {
  if (!goog.dom.contains(this.infobar_, messageElement)) {
    return;
  }
  goog.dom.removeNode(messageElement);
  --this.messageCounter_;
  if (this.messageCounter_ == 0) {
    this.hideInfobar_();
  }
  if (messageId) {
    chrome.extension.sendRequest(
        {'action': Bite.Constants.HUD_ACTION.SET_LOCAL_STORAGE,
         'key': bite.ux.Container.Keys_.SHOWN_MESSAGES + messageId,
         'value': 't'});
  }
};


/**
 * Saves the size and position of the console. The location information
 * is stored in the background so that the console position is constant
 * across URLs and across tabs. When a new BITE container with the same
 * ID as this is opened, it will use the last saved size and position.
 * @private
 */
bite.ux.Container.prototype.setLastSizeAndPosition_ = function() {
  var consoleLocation = {
    position: common.dom.element.getPosition(this.root_),
    size: common.dom.element.getSize(this.root_)
  };
  chrome.extension.sendRequest(
      {action: Bite.Constants.HUD_ACTION.SET_LOCAL_STORAGE,
       key: bite.ux.Container.Keys_.CONSOLE_LOCATION + this.consoleId_,
       value: goog.json.serialize(consoleLocation)});
};


/**
 * Requests the location information for a newly opened console.
 * @private
 */
bite.ux.Container.prototype.getSavedConsoleLocation_ = function() {
  chrome.extension.sendRequest(
      {action: Bite.Constants.HUD_ACTION.GET_LOCAL_STORAGE,
       key: bite.ux.Container.Keys_.CONSOLE_LOCATION + this.consoleId_},
      goog.bind(this.handleGetSavedConsoleLocation_, this));
};


/**
 * Updates the location information for a newly opened console. The location
 * is expected to be an object of the form:
 *     {position: {x: number, y: number},
 *      size: {height: number, width: number}}
 * @param {?string} rawLocation The raw string of the location from
 *     localStorage, or null if there is no stored location.
 * @private
 */
bite.ux.Container.prototype.handleGetSavedConsoleLocation_ =
    function(rawLocation) {
  var location = bite.ux.Container.DEFAULT_CONSOLE_LOCATION_;
  if (rawLocation) {
    try {
      location = /** @type {!bite.ux.Container.Location} */
          (goog.json.parse(rawLocation));
    } catch (error) {
      chrome.extension.sendRequest(
          {action: Bite.Constants.HUD_ACTION.REMOVE_LOCAL_STORAGE,
           key: bite.ux.Container.Keys_.CONSOLE_LOCATION +
                this.consoleId_});
    }
  }
  this.updateConsolePosition(location);
};


/**
 * Updates the console to the size and location given in the parameter.
 * @param {!bite.ux.Container.Location} location The location info.
 */
bite.ux.Container.prototype.updateConsolePosition = function(location) {
  common.dom.element.setPosition(this.root_, location.position);
  common.dom.element.setSize(this.root_, location.size);
  this.resizer_.recalculate();
  this.dragger_.recalculate();
};


/**
 * Handles the event when the user clicks on the close button.
 * @private
 */
bite.ux.Container.prototype.closeHandler_ = function() {
  this.closeCallback_();
};


/**
 * Handles the event when the user closes the infobar.
 * @private
 */
bite.ux.Container.prototype.closeInfobarHandler_ = function() {
  this.hideInfobar_();
};

