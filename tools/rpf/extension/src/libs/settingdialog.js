// Copyright 2010 Google Inc. All Rights Reserved.
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
 * @fileoverview This file contains RPF's setting dialog.
 * It gets popped up when user clicks the settings button.
 *
 * @author phu@google.com (Po Hu)
 */

goog.provide('rpf.SettingDialog');

goog.require('Bite.Constants');
goog.require('bite.common.mvc.helper');
goog.require('goog.dom');
goog.require('goog.dom.TagName');
goog.require('goog.events');
goog.require('goog.ui.Dialog');
goog.require('rpf.Console.Messenger');
goog.require('rpf.MiscHelper');
goog.require('rpf.soy.Dialog');



/**
 * A class for showing setting dialog.
 * This dialog shows user options to set playback interval,
 * or test user's specified script.
 * @param {function(Bite.Constants.UiCmds, Object, Event)} onUiEvents
 *     The function to handle the specific event.
 * @constructor
 * @export
 */
rpf.SettingDialog = function(onUiEvents) {
  /**
   * The setting dialog.
   * @type Object
   * @private
   */
  this.settingDialog_ = new goog.ui.Dialog();

  /**
   * The messenger.
   * @type {rpf.Console.Messenger}
   * @private
   */
  this.messenger_ = rpf.Console.Messenger.getInstance();

  /**
   * The function to handle the specific event.
   * @type {function(Bite.Constants.UiCmds, Object, Event)}
   * @private
   */
  this.onUiEvents_ = onUiEvents;

  /**
   * Inits the setting dialog.
   */
  this.initSettingDialog_();
};


/**
 * Localstorage name for whether takes screenshots.
 * @type {string}
 * @private
 */
rpf.SettingDialog.TAKE_SCREENSHOTS_ = 'takeScreenshots';


/**
 * Localstorage name for whether uses xpath.
 * @type {string}
 * @private
 */
rpf.SettingDialog.USE_XPATH_ = 'useXpath';


/**
 * Localstorage name for whether to show tips.
 * @type {string}
 * @private
 */
rpf.SettingDialog.SHOW_TIPS_ = 'showTips';


/**
 * Inits the setting dialog.
 * @private
 */
rpf.SettingDialog.prototype.initSettingDialog_ = function() {
  var dialogElem = this.settingDialog_.getContentElement();
  bite.common.mvc.helper.renderModelFor(dialogElem,
                                        rpf.soy.Dialog.settingsContent);
  this.settingDialog_.setTitle('Settings');
  this.settingDialog_.setButtonSet(null);
  this.settingDialog_.setVisible(true);

  this.registerListeners_();
  this.initPlaybackInterval_();
  this.initTimeout_();
  this.initTakeScreenshotsCheckbox_();
  this.initUseXpath_();
  this.initShowTips_();
  this.settingDialog_.setVisible(false);
};


/**
 * Generates the webdriver code directly.
 * @private
 */
rpf.SettingDialog.prototype.registerListeners_ = function() {
  goog.events.listen(
      goog.dom.getElement('playbackintervalbutton'),
      'click',
      goog.bind(this.setPlaybackInterval_, this));
  goog.events.listen(
      goog.dom.getElement('defaulttimeoutbutton'),
      'click',
      goog.bind(this.setTimeout_, this));
  goog.events.listen(
      goog.dom.getElement('whethertakescreenshot'),
      'click',
      goog.bind(this.setTakeScreenshot_, this));
  goog.events.listen(
      goog.dom.getElement('whetherUseXpath'),
      'click',
      goog.bind(this.setUseXpath_, this));
  goog.events.listen(
      goog.dom.getElement('whetherShowTips'),
      'click',
      goog.bind(this.setShowTips_, this));
};


/**
 * Sets whether take the screenshots while recording.
 * @private
 */
rpf.SettingDialog.prototype.initTakeScreenshotsCheckbox_ =
    function() {
  var takes = goog.global.localStorage.getItem(
      rpf.SettingDialog.TAKE_SCREENSHOTS_);
  if (!takes || takes == 'true') {
    goog.dom.getElement('whethertakescreenshot').checked = true;
  } else {
    this.messenger_.sendMessage(
        {'command': Bite.Constants.CONSOLE_CMDS.SET_TAKE_SCREENSHOT,
         'params': {'isTaken': false}});
  }
};


/**
 * Sets whether take the screenshots while recording.
 * @private
 */
rpf.SettingDialog.prototype.setTakeScreenshot_ = function() {
  var checked = goog.dom.getElement('whethertakescreenshot').checked;
  goog.global.localStorage[
      rpf.SettingDialog.TAKE_SCREENSHOTS_] = checked;
  this.messenger_.sendMessage(
      {'command': Bite.Constants.CONSOLE_CMDS.SET_TAKE_SCREENSHOT,
       'params': {'isTaken': checked}});
};


/**
 * Gets whether to use xpath.
 * @return {boolean} Whether to use xpath.
 */
rpf.SettingDialog.prototype.getUseXpath = function() {
  return goog.dom.getElement('whetherUseXpath').checked;
};


/**
 * Sets whether uses the xpath to replay.
 * @private
 */
rpf.SettingDialog.prototype.setUseXpath_ = function() {
  var checked = goog.dom.getElement('whetherUseXpath').checked;
  goog.global.localStorage[rpf.SettingDialog.USE_XPATH_] = checked;
  this.messenger_.sendMessage(
      {'command': Bite.Constants.CONSOLE_CMDS.SET_USE_XPATH,
       'params': {'use': checked}});
};


/**
 * Sets whether uses xpath.
 * @private
 */
rpf.SettingDialog.prototype.initUseXpath_ = function() {
  var use = goog.global.localStorage.getItem(rpf.SettingDialog.USE_XPATH_);
  if (use && use == 'true') {
    goog.dom.getElement('whetherUseXpath').checked = true;
    this.messenger_.sendMessage(
        {'command': Bite.Constants.CONSOLE_CMDS.SET_USE_XPATH,
         'params': {'use': true}});
  }
};


/**
 * Gets whether to show tips.
 * @return {boolean} Whether to show tips.
 */
rpf.SettingDialog.prototype.getShowTips = function() {
  return goog.dom.getElement('whetherShowTips').checked;
};


/**
 * Sets whether to show tips.
 * @param {boolean} show Whether to show the tips.
 * @export
 */
rpf.SettingDialog.prototype.automateShowTips = function(show) {
  goog.dom.getElement('whetherShowTips').checked = show;
  this.setShowTips_();
};


/**
 * Sets whether to show tips.
 * @private
 */
rpf.SettingDialog.prototype.setShowTips_ = function() {
  var checked = goog.dom.getElement('whetherShowTips').checked;
  goog.global.localStorage[rpf.SettingDialog.SHOW_TIPS_] = checked;
  this.onUiEvents_(
      Bite.Constants.UiCmds.SET_SHOW_TIPS,
      {'show': checked},
      /** @type {Event} */ ({}));
};


/**
 * Sets whether to show tips.
 * @private
 */
rpf.SettingDialog.prototype.initShowTips_ = function() {
  var show = goog.global.localStorage.getItem(rpf.SettingDialog.SHOW_TIPS_);
  if (!show || show == 'true') {
    goog.dom.getElement('whetherShowTips').checked = true;
  } else {
    this.onUiEvents_(
        Bite.Constants.UiCmds.SET_SHOW_TIPS,
        {'show': false},
        /** @type {Event} */ ({}));
  }
};


/**
 * Inits the playback redirection timeout.
 * @private
 */
rpf.SettingDialog.prototype.initTimeout_ = function() {
  goog.dom.getElement('defaulttimeout').value =
      Bite.Constants.RPF_PLAYBACK.REDIRECTION_TIMEOUT / 1000;
};


/**
 * Sets time out.
 * @private
 */
rpf.SettingDialog.prototype.setTimeout_ = function() {
  var time = parseInt(goog.dom.getElement('defaulttimeout').value, 10);
  if (isNaN(time)) {
    alert('Invalid input, please type in a number.');
    return;
  }
  time = time * 1000;
  this.messenger_.sendMessage(
      {'command': Bite.Constants.CONSOLE_CMDS.SET_DEFAULT_TIMEOUT,
       'params': {'time': time}});
  this.onUiEvents_(
      Bite.Constants.UiCmds.SET_CONSOLE_STATUS,
      {'message': 'Saved the playback timeout successfully.',
       'color': 'green'},
      /** @type {Event} */ ({}));
};


/**
 * Inits the playback interval box.
 * @private
 */
rpf.SettingDialog.prototype.initPlaybackInterval_ = function() {
  goog.dom.getElement('playbackinterval').value =
      Bite.Constants.RPF_PLAYBACK.INTERVAL * 1.0 / 1000;
};


/**
 * Sets the playback interval in seconds.
 * @private
 */
rpf.SettingDialog.prototype.setPlaybackInterval_ = function() {
  var interval = parseFloat(goog.dom.getElement('playbackinterval').value);
  if (isNaN(interval)) {
    alert('Invalid input, please type in a float number.');
    return;
  }
  this.messenger_.sendMessage(
      {'command': Bite.Constants.CONSOLE_CMDS.SET_PLAYBACK_INTERVAL,
       'params': {'interval': interval}});
  this.onUiEvents_(
      Bite.Constants.UiCmds.SET_CONSOLE_STATUS,
      {'message': 'Saved the playback interval successfully.',
       'color': 'green'},
      /** @type {Event} */ ({}));
};


/**
 * Sets the visibility of the setting dialog.
 * @param {boolean} display Whether to show the dialog.
 * @export
 */
rpf.SettingDialog.prototype.setVisible = function(display) {
  this.settingDialog_.setVisible(display);
};

