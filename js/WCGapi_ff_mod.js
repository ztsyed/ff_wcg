(function($)
{

  // Geoff added
  var sipdomain = "vims1.com";
  var server = "http://64.124.154.165:38080/HaikuServlet/rest/v2";
  
	// Random, unique, unpredictable
	// Both uuidCounter++ are needed and Math.random.
	// uuidCounter++ ensures unique
	// Math.random() ensures unpredictable
	// Prints it out as hex with no other punctuation (looks neater)
	var uuidCounter = 0;
	var uuid = function()
	{
		return Math.random().toString(16).substring(2) + (uuidCounter++).toString(16);
	};

	function PhonoCall(ms, destination, config, oCall)
	{

		var call = oCall;

		if (!call)
			call = ms.createCall(destination, {audio: true, video: true});

		if (!config)
			config = {};

		$.extend(this, config);

		this.state = "initial";
		var mt = this;

		call.onstatechange = function(e)
		{
			console.log("New state: " + e.state);
			if (e.state == Call.State.RINGING && mt.onRing)
			{
				mt.onRing(e);
				mt.state = "ringing";
			}
			if (e.state == Call.State.ONGOING && mt.onAnswer)
			{
				mt.onAnswer(e);
				mt.state = "connected";
			}
			if (e.state == Call.State.ENDED && mt.onHangup)
			{
				console.log(mt.onHangup);
				mt.onHangup(e);
				mt.state = "disconnected";
			}
			if (e.state == Call.State.ERROR && mt.onError)
			{
				mt.onError(e);
				mt.state = "disconnected";
			}
		}

		call.onaddstream = function(e)
		{
			// TODO: Add the stream to an element.
			// This is not possible (nor useful) in current Chrome
			if (mt.onAddStream)
				mt.onAddStream(e);
		}	

		this.__defineGetter__("localStreams", function() { return call.localStreams; });
		this.__defineGetter__("remoteStreams", function() { return call.localStreams; });

		if (!destination) {
			this.__defineGetter__("from", function() { return call.recipient; });
      this.__defineGetter__("initiator", function() { return call.recipient; });
    }

		this.id = uuid();
		this.call = call;

		if (!oCall)
			call.ring();
	}

	PhonoCall.prototype.answer = function() { this.call.answer(); };
	PhonoCall.prototype.hangup = function() { this.call.end(); };
	PhonoCall.prototype.digit = function() { };
	PhonoCall.prototype.pushToTalk = function() { };
	PhonoCall.prototype.talking = function() { };
	PhonoCall.prototype.mute = function() { };
	PhonoCall.prototype.hold = function() { };
	PhonoCall.prototype.volume = function() { };
	PhonoCall.prototype.gain = function() { };

	function Phone(ms, config)
	{
		this._ms = ms;
		if (!config) config = {};
		this._config = config;

		$.extend(this, config);

		if (!this.onError)
			this.onError = function(){
				console.warn("Error occurred with no handler there");
			};
	}

	Phone.prototype.dial = function(destination, config)
	{
		if (!config.video)
			config.video = this.video;

    var sipDestination = "sip:"+destination + "@" + sipdomain;
		this.call = new PhonoCall(this._ms, sipDestination, config);
		return this.call;
	};

	Phone.prototype.tones = function(){};
	Phone.prototype.headset = function(){};
	Phone.prototype.wideband = function(){};
	Phone.prototype.ringTone = function(){};
	Phone.prototype.ringbackTone = function(){};

	function H2SPhono(config)
	{
		this._config = config;

    if(config.apiKey.indexOf("oauth" == -1)) {
      config.apiKey = "oauth " +  config.apiKey;
    }

    if (!config.sipdomain)
        config.sipdomain = sipdomain;
    
    if (!config.server)
        config.server = server;

		$.extend(this, config);

		if (!this.user)
			this.user = uuid();

		//this._ms = new MediaServices("http://api.tfoundry.com/a1/H2SConference", uuid(), config.apiKey, "audio");

		var mt = this;

		var mediaType = (config.video ? "audio,video" : "audio");

		this._ms = new MediaServices(this.server, this.user, config.apiKey, mediaType);
		this._ms.onready = function() { setTimeout(function() { mt._ms.unregister(); }, 500) };
		this._ms.onclose = function() { setTimeout(function() {


			mt._ms = new MediaServices(mt.server, mt.user, config.apiKey, mediaType);
			mt._ms.turnConfig = "NONE";

			// preserve "this" for callbacks
			mt._ms.onclose = function(e) { if (mt.onUnready) mt.onUnready(e); };
			mt._ms.onerror = function(e) { mt.onerror(e); };
			mt._ms.oninvite = function(e) { mt.oninvite(e); };
			mt._ms.onready = function(e) { mt.sessionId = mt._ms.username; if (mt.onReady) mt.onReady(e); };

			mt.phone = new Phone(mt._ms, config.phone);

		}, 500); };

	}

  // Connect
  H2SPhono.prototype.connect = function (config) {
    return new H2SPhono(cfg);
  } 
  
  // Disconnect
  H2SPhono.prototype.disconnect = function () {
    this._ms.unregister();
    this.phono = null;
  } 
  
  // Connected?
  H2SPhono.prototype.connected = function () {
    return this.phono;
  } 

	H2SPhono.prototype.onerror = function(evt)
	{
		// TODO: Ensure error event format matches
		if(this.phone._call && this.phone._call.onerror)
		{
			this.phone._call.onerror(evt);
		}
		else
		{
			this.phone.onerror(evt);
		}
	}

	H2SPhono.prototype.oninvite = function(evt)
	{
		if (evt.call && this.phone.onIncomingCall)
			this.phone.onIncomingCall({call: new PhonoCall(this._ms, null, null, evt.call)});
	}

	$.extend({h2sphono: function(cfg) { return new H2SPhono(cfg); }});

})(jQuery);
/**
 * WCG Javascript Library
 * With WebRTC support for Google Chrome using JSEP (ROAP is supported but deprecated)
 *
 * @author Philip Mark, Maxime-Alexandre Marchand, Paul Ghanime
 * @version 2.1.15 FF   (modifications to support Firefox by epetstr)
 * Copyright: 2012 Ericsson
 */

if (typeof Logs === "undefined") {
	Logs = true;
}
		
(function(parent) {
	// noop logger
	// note that all three functions are present in console and can be used
	var logger = {
		log: function(){},
		warn: function(){},
		error: function(){}
	};
	
	// op logger. Only enable due to a flag. At the moment, no flag (true).
	// Change this to disable logging in one place.
	if (Logs)
		logger = console;


	// WCG URL resources
	var SESSION = "session",
		REGISTER_RESOURCE = "register",
		CONFERENCE_RESOURCE = "mediaconf",
		CONFERENCE_RESOURCE_ADD = "add",
		CONFERENCE_RESOURCE_REMOVE = "remove",
		AUDIOVIDEO_RESOURCE = "audiovideo",
		CHANNEL_RESOURCE = "channels",
		FILETRANSFER_RESOURCE = "filetransfer",
		FILETRANSFER_RESOURCE_SEND = "sendfile",
		FILETRANSFER_RESOURCE_UPLOAD = "uploadfiledata",
		FILETRANSFER_RESOURCE_ACCEPT = "accept",
		FILETRANSFER_RESOURCE_TERMINATE = "terminate",
		FILETRANSFER_RESOURCE_GETFILE = "getfiledata",
		ADDRESSBOOK_RESOURCE = "ab",
		ADDRESSBOOK_RESOURCE_CONTACTS = "contacts",
		CHAT_RESOURCE = "message",
		CHAT_RESOURCE_SEND = "send",
		CHAT_RESOURCE_SEND_ISCOMPOSING = "send-iscomposing",
		CHAT_RESOURCE_SEND_MEDIA = "sendmedia?to=",
		CHAT_RESOURCE_GET_MEDIA = "getmedia?fileRef=",
		GROUP_CHAT_RESOURCE = "groupchat",
		GROUP_CHAT_CREATE = "create",
		GROUP_CHAT_LEAVE = "leave",
		GROUP_CHAT_ADD = "addparticipants",
		GROUP_CHAT_JOIN = "join",
		GROUP_CHAT_ACCEPT = "invite/accept",
		GROUP_CHAT_DECLINE = "invite/decline",
		GROUP_CHAT_RESOURCE_SEND_MEDIA = "sendmedia?confId=";
		PRESENCE_RESOURCE = "presence",
		PRESENCE_RESOURCE_USER = "user",
		PRESENCE_RESOURCE_USER_SUBSCRIBE = "subscribe",
		PRESENCE_RESOURCE_USER_PUBLISH = "publish",
		PRESENCE_RESOURCE_USER_ANONYMOUS = "anonymous",
		PRESENCE_RESOURCE_LIST = "list",
		PRESENCE_RESOURCE_LIST_ADD = "adduser",
		PRESENCE_RESOURCE_LIST_REMOVE = "removeuser",
		PRESENCE_RESOURCE_LIST_BLOCK = "blockuser",
		CONTENT_RESOURCE = "content",
		CONTENT_RESOURCE_GETAVATAR = "getavatar",
		CONTENT_RESOURCE_SETAVATAR = "setavatar",
		CONTENT_RESOURCE_DELETEAVATAR = "deleteavatar";
	
	// Presence service descriptions. Taken from RCS specs document
	var SERVICE = {
		MESSAGING_STANDALONE : {
			serviceDescription : "org.3gpp.urn:urn-7:3gpp-application.ims.iari.rcs.sm",
			serviceVersion : "1.0"
		},
		MESSAGING_SESSION_MODE : {
			serviceDescription : "org.openmobilealliance:IM-session",
			serviceVersion : "1.0"
		},
		FILE_TRANSFER : {
			serviceDescription : "org.openmobilealliance:File-Transfer",
			serviceVersion : "1.0"
		},
		IMAGE_SHARE : {
			serviceDescription : "org.gsma.imageshare",
			serviceVersion : "1.0"
		},
		VIDEO_SHARE_1 : {
			serviceDescription : "org.gsma.videoshare",
			serviceVersion : "1.0"
		},
		VIDEO_SHARE_2 : {
			serviceDescription : "org.gsma.videoshare",
			serviceVersion : "2.0"
		},
		SOCIAL_PRESENCE : {
			serviceDescription : "org.3gpp.urn:urn-7:3gpp-application.ims.iari.rcse.sp",
			serviceVersion : "1.0"
		},
		CAPABILITY_DISCOVERY : {
			serviceDescription : "org.3gpp.urn:urn-7:3gpp-application.ims.iari.rcse.dp",
			serviceVersion : "1.0"
		},
		VOICE_CALL : {
			serviceDescription : "org.3gpp.urn:urn-7:3gpp-service.ims.icsi.mmtel",
			serviceVersion : "1.0"
		},
		VIDEO_CALL : {
			serviceDescription : "org.3gpp.urn:urn-7:3gpp-service.ims.icsi.mmtel",
			serviceVersion : "1.0"
		},
		GEOLOCATION_PUSH : {
			serviceDescription : "org.3gpp.urn:urn-7:3gpp-application.ims.iari.rcs.geopush",
			serviceVersion : "1.0"
		},
		GEOLOCATION_PULL : {
			serviceDescription : "org.3gpp.urn:urn-7:3gpp-application.ims.iari.rcs.geopull",
			serviceVersion : "1.0"
		}
	};
	
	// TODO: this is a parameter that can be fetched with getParameter from the REST API
	var MAX_MEDIA_SIZE = 51200; // Media message size
	
	// Signature on this can vary. Basically it has a URL to the gateway and some form of access token.
	// It auto-registers after the current event loop
	/**
	Creates a new MediaServices instance. This instance can be used to request new media services and to respond to incoming media requests.
	@class The MediaServices class is the main entry point of the application. It registers with the media gateway, 
	creates outgoing calls and new conferences, and accepts incoming calls.<br />
	@property {MediaServices.State} state State of the MediaServices.
	@property {String} mediaType The media type(s) supported by this MediaServices object.
	@property {String} turnConfig The TURN server URL. (e.g. "provserver.televolution.net") Defaults to "NONE" if not set.
	@property {String} willingness The willingness status of the user. This will be published automatically.
	@property {String} tagline The tagline of the user. This will be published automatically.
	@property {Object} homepage The homepage of the user (should be an object with field: homepage.url and homepage.label). This will be published automatically.
	@property {String} username (readyonly)
	@property {ContactList} contactList
	@param {String} gwUrl URL to the MediaGateway, including the protocol scheme (e.g. "http://129.192.188.88:9191/HaikuServlet/rest/v2/"). This is also described as the base URL.
	@param {String} username Name/identity to register with the Media Gateway. For SIP users, start with "sip:" (e.g. "sip:name@domain.com")
	@param {String} authentication SIP password or authorization token. If registering with oAuth, this parameter should begin with "oauth" (e.g. "oauth mytoken")
	@param {String} services Media services that the user supports. Any combination of "audio,video,ftp,chat".
	@throws {TypeError} Invalid username
	@throws {Error} Invalid user services
	@example
ms = new MediaServices("http://129.192.188.88:9191/HaikuServlet/rest/v2/", "sip:name@domain.com", "0faeb2c", "audio,video,ftp,chat");
// or
ms = new MediaServices("http://129.192.188.88:9191/HaikuServlet/rest/v2/", "name@domain.com", "oauth 0faeb2c", "audio,video");
ms.onclose = function(evt) {};
ms.onerror = function(evt) {};
ms.oninvite = function(evt) {};
ms.onstatechange = function(evt) {};
ms.onready = function(evt) {
	// Perform an action, such as outgoing call
};
	*/
	MediaServices = function(gwUrl, username, authentication, services) {
		var _state = MediaServices.State.INITIALISED,
			_services = services,
			_turnConfig = "NONE",
			_username = username;
		
		/**
		Base URL including session ID ("baseURL"/"sessionID"/)
		@private
		*/
		this._gwUrl = (gwUrl.substr(-1) == "/") ? gwUrl : gwUrl + "/";
		this._host = gwUrl.substring(0, gwUrl.indexOf("HaikuServlet"));

		/**
		Event channel
		@private
		*/
		this._channel = null;
		
		/**
		Current Call object
		@private
		*/
		this._call = null;
		
		/**
		Current Transfer Target Call object
		@private
		*/
		this._transferTargetCall = null;
		
		/**
		Is user a SIP user or Web user
		@private
		*/
		this._isSipUser = (username.indexOf("sip:") == 0) ? true : false;
		
		/**
		Hashmap of FileTransfer objects
		@private
		*/
		this._ftp = new _HashMap();
		
		/**
		Session ID (the ID is needed for file transfer)
		@private
		*/
		this._sessionID = null;
		
		/**
		A ContactList object
		@private
		*/
		this._contactList = null;
		
		/**
		Hashmap of Chat and GroupChat objects
		@private
		*/
		this._chat = new _HashMap();
		
		this._willingness;
		
		this._tagline = "";
		
		this._homepage = "";
		
		/**
		Access token (used for oAuth)
		E.g. "oauth mytoken"
		@private
		*/
		this._accessToken = (authentication.indexOf("oauth ") == 0) ? authentication.substring(6, authentication.length) : null;
		
		/**
		@field state
		Object's state
		*/
		Object.defineProperty(this, "state", {
			get: function()
			{
				return _state;
			},
			
			set: function(newState)
			{
				_state = newState;
				
				if (typeof(this.onstatechange) == "function") {
					var evt = {type: "statechange", oldState : _state, state: newState};
					this.onstatechange(evt);
				}
				
				// Dispatch appropriate states
				if (newState == MediaServices.State.READY && typeof(this.onready) == "function")
					this.onready(evt);
				else if (newState == MediaServices.State.CLOSED && typeof(this.onclose) == "function")
					this.onclose(evt);
			}
		});
		
		/**
		@field mediaType
		@readonly
		The media type(s) supported by this MediaServices object
		*/
		Object.defineProperty(this, "mediaType", {
			get: function() { return _services; }
		});
		
		/**
		@field turnConfig
		The TURN server configuration
		*/
		Object.defineProperty(this, "turnConfig", {
			get: function() { return _turnConfig; },
			set: function(turnConfig) { _turnConfig = turnConfig; }
		});
		
		/**
		@field contactList
		*/
		Object.defineProperty(this, "contactList", {
			get: function() { return this._contactList; }
		});
		
		/**
		@field willingness
		*/
		Object.defineProperty(this, "willingness", {
			get: function() { return this._willingness; },
			set: function(willingness) {
				this._willingness = willingness;
				this._publish({ willingness : willingness });
			}
		});
		
		/**
		@field tagline
		*/
		Object.defineProperty(this, "tagline", {
			get: function() { return this._tagline; },
			set: function(tagline) {
				this._tagline = tagline; 
				this._publish({ freeText : tagline });
			}
		});
		
		/**
		@field homepage
		*/
		Object.defineProperty(this, "homepage", {
			get: function() { return this._homepage; },
			set: function(homepage) {
				this._homepage = homepage;
				if (homepage.url && homepage.label) {
					this._publish({ homepage : homepage });
				}
			}
		});
		
		/**
		@field username
		@readonly
		*/
		Object.defineProperty(this, "username", {
			get: function() { return _username; }
		});
		
		// Auto register right away
		this._register(username, authentication);
	};
	
	/**
	TODO: keep this private?
	@private
	*/
	MediaServices.prototype._getVersion = function() {
		var url = this._gwUrl + "application/version";
		var req = new _CreateXmlHttpReq();
			
		req.open("GET", url, true);
		req.setRequestHeader("Accept", "application/json, text/html");
		req.send(null);
		
		req.onreadystatechange = function() {
			if (this.readyState == 4) {
				if (this.status == 200) {
					logger.log(this.responseText);
				}
			}
		};	
	};
	
	/**
	TODO: keep this private?
	@private
	*/
	MediaServices.prototype._getInfo = function() {
		var url = this._gwUrl + "application/info";
		var req = new _CreateXmlHttpReq();
			
		req.open("GET", url, true);
		req.setRequestHeader("Accept", "application/json, text/html");
		req.send(null);
		
		req.onreadystatechange = function() {
			if (this.readyState == 4) {
				if (this.status == 200) {
					logger.log(this.responseText);
				}
			}
		};	
	};
	
	/**
	WCG user registration
	@private
	@return void
	@throws {Error} Invalid username
	@throws {Error} Invalid authentication
	@throws {Error} Invalid user services
	*/
	MediaServices.prototype._register = function(username, authentication) {
		var mediaService = this;
		var registerURL = this._gwUrl + REGISTER_RESOURCE;
		
		logger.log("Media service initialised");
		//if(this._accessToken == null) {
			if (typeof(username) != "string" || username == "") {
				throw new Error(MediaServices.Error.INVALID_CREDENTIALS);
			//} else if (typeof(authentication) != "string" || authentication == "") {
			//	throw new Error(MediaServices.Error.INVALID_CREDENTIALS);
			}
		//}
		
		if (typeof(this.mediaType) != "string") {
			throw new TypeError(MediaServices.Error.INVALID_SERVICES);
		}
		
		// Check if user services are valid
		var _services = [];
	
		var tokens = this.mediaType.toLowerCase().replace(/(\s)/g, "").split(",");
		
		for (var i = 0; i < tokens.length; i++) {
			if (tokens[i] == "audio") {
				_services.push("ip_voice_call");
			} else if (tokens[i] == "video") {
				_services.push("ip_video_call");
			} else if (tokens[i] == "ftp") {
				_services.push("file_transfer");
			} else if (tokens[i] == "chat") {
				_services.push("im_chat");
			}
		}
		
		if (_services.length < 1) {
			throw new Error("Invalid user services");
		}
		
		var body = null;
		//if(this._accessToken == null) {
			if (this._isSipUser) {
				// Remove "sip:" prefix
				username = username.slice(4, username.length);
			
				// SIP users supports Address Book and Presence by default
				_services.push("ab");
				_services.push("presence");
				
				body = {
					username : username,
					password : authentication,
					mediaType : "rtp",
					services : _services
				};
		//	}
		} else {
			body = {
				username : username,
				mediaType : "rtp",
				services : _services
			};
		}

		// Create and send a register request
		var req = new _CreateXmlHttpReq(this._accessToken);
		
		req.open("POST", registerURL, true);
		req.setRequestHeader("Content-Type", "application/json");
		req.setRequestHeader("Accept", "application/json, text/html");
		req.send(JSON.stringify(body, null, " "));
		
		// On response
		req.onreadystatechange = function() {
			if (this.readyState == 4) {
				mediaService.state = MediaServices.State.REGISTERING;
				logger.log("Registering...");

				// Success response 201 Created
				if (this.status == 201) {
					// Extract the sessionID from JSON body
					var json = JSON.parse(this.responseText);
					var tokens = json.resourceURL.split("/");
					var index = tokens.indexOf("session");

					mediaService._sessionID = tokens[index + 1];
					mediaService._gwUrl += SESSION + '/' + mediaService._sessionID + '/';
					
					// Start polling the event channel
					mediaService._channel = new _Channel(mediaService);
					mediaService._channel.pollChannel();

					
					if (mediaService._isSipUser) {
						// Create a new contact list
						mediaService._contactList = new ContactList(mediaService);
						mediaService._contactList._url = mediaService._gwUrl;
						mediaService._contactList.update();

						// Publish self services
						console.log("FF JSL: PUBLISH removed due to problems with IMS setup, not needed for Inweb setup");
						//mediaService._publishServices();
					}
					logger.log("Registration successful");
					
					mediaService.state = MediaServices.State.READY;
				} else {
					logger.log("Registration unsuccessful: " + this.status + " " + this.statusText);
					
					switch (this.status) {
						case 401: // 401 Unauthorized
						case 403: // 403 Forbidden
							_InternalError(mediaService, MediaServices.Error.INVALID_CREDENTIALS);
							break;
						default:
							_InternalError(mediaService, MediaServices.Error.NETWORK_FAILURE);
							break;
					}
				}
			};
		};
	};
	
	/**
	@namespace Describes the possible states of the MediaServices object.
	*/
	MediaServices.State = {};
	
	/**
	The MediaServices object is initialised, but has not yet begun registration with the media gateway
	*/
	MediaServices.State.INITIALISED = 0;
	
	/**
	The MediaServices object registration and authentication are in progress
	*/
	MediaServices.State.REGISTERING = 1;
	
	/**
	The MediaServices object has registered and authenticated, and can now be used to create and receive media
	*/
	MediaServices.State.READY = 2;
	
	/**
	The MediaServices object unregistration is in progress
	*/
	MediaServices.State.UNREGISTERING = 3;
	
	/**
	The MediaServices object session has ended in a controlled and expected manner, and the object can no longer be used
	*/
	MediaServices.State.CLOSED = 4;
	
	/**
	The MediaServices object session has ended abruptly, in an unexpected manner (network failure, server error, etc), and the object can no longer be used
	*/
	MediaServices.State.ERROR = 5;
	
	/**
	@namespace Describes the possible errors of the MediaServices object.
	*/
	MediaServices.Error = {};
	
	/**
	Generic network failure.
	*/
	MediaServices.Error.NETWORK_FAILURE = 0;
	
	/**
	Registration failed due to invalid credentials. 
	*/
	MediaServices.Error.INVALID_CREDENTIALS = 1;
	
	/**
	Registration failed due to invalid services. 
	*/
	MediaServices.Error.INVALID_SERVICES = 2;
	
	/**
	Re-registers the client. 
	@function
	@return void
	@example
ms.reregister();
	*/
	MediaServices.prototype.reregister = function() {
		var mediaService = this;
		var reregisterURL = mediaService._gwUrl + REGISTER_RESOURCE;
		
		logger.log("Reregistering...");
		
		this.state = MediaServices.State.REGISTERING;
		
		// Create a new logout request
		var req = new _CreateXmlHttpReq(this._accessToken);
		
		req.open("PUT", reregisterURL, true);
		req.setRequestHeader("X-http-method-override", "PUT");
		req.setRequestHeader("Accept", "application/json, text/html");
		req.send(null);
		
		// On response
		req.onreadystatechange = function() {
			if (this.readyState == 4) {
				var json = JSON.parse(this.responseText);
			
				// Success response 200 OK
				if (this.status == 200) {
					logger.log("Reregistration successful " + json.expires);
					
					mediaService.state = MediaServices.State.READY;
				} else {
					logger.log("Reregistration unsuccessful: " + this.status + " " + this.statusText);
					
					_InternalError(mediaService, MediaServices.Error.NETWORK_FAILURE);
				}
			}
		};
	};
	
	/**
	Unregisters the user from the current media service session. When completed successfully, MediaServices will change state to CLOSED.
	@function
	@return void
	@example
ms.unregister();
	*/
	MediaServices.prototype.unregister = function() {
		var mediaService = this;
		var unregisterURL = mediaService._gwUrl + REGISTER_RESOURCE;
		
		logger.log("Deregistering...");
		
		this.state = MediaServices.State.UNREGISTERING;
		
		// Create a new logout request
		var req = new _CreateXmlHttpReq();
		
		req.open("DELETE", unregisterURL, true);
		req.setRequestHeader("X-http-method-override", "DELETE");
		req.setRequestHeader("Accept", "application/json, text/html");
		req.send(null);
		
		// On response
		req.onreadystatechange = function() {
			if (this.readyState == 4) {
				mediaService._clean();					
				mediaService.state = MediaServices.State.CLOSED;
				// Success response 204 No content
				if (this.status == 204) {
					logger.log("Deregistration successful");
				} else {
					logger.log("Deregistration unsuccessful: " + this.status + " " + this.statusText);
					_InternalError(mediaService, MediaServices.Error.NETWORK_FAILURE);
				}
			}
		};
	};
	
	/**
	TODO: is this function useful?
	*/
	MediaServices.prototype.anonymousSubscribe = function() {
		var mediaService = this;
		
		var url = this._gwUrl + PRESENCE_RESOURCE + '/' + PRESENCE_RESOURCE_USER + '/' + PRESENCE_RESOURCE_USER_ANONYMOUS 
			+ '/' + PRESENCE_RESOURCE_USER_SUBSCRIBE;
		
		logger.log("Anonymous subscribing...");
		
		var list = [];
		
		if (this._contactList) {
			for (var i in this._contactList.contact) {
				list.push("tel:+" + this._contactList.contact[i]._id);
			}
		}
		
		if (list.length == 0) {
			logger.log("No one to subscribe to");
			return;
		}
		
		var body = {
			entities : list
		};
		
		// Create and send a follow contact request
		var req = new _CreateXmlHttpReq();
		
		req.open("POST", url, true);
		req.setRequestHeader("Accept", "application/json, text/html");
		req.setRequestHeader("Content-Type", "application/json");
		req.send(JSON.stringify(body, null, " "));
	
		// On response
		req.onreadystatechange = function() {
			if (req.readyState == 4) {
				// Success response 202 Accepted
				if (req.status == 202) {
					logger.log("Anonymous subscribe successful");
				} else {
					var json = JSON.parse(req.responseText);
					logger.log("Anonymous subscribe failed: " + json.reason);
					_InternalError(mediaService, MediaServices.Error.NETWORK_FAILURE);
				}
			}
		};
	};
	
	/**
	Obtain to the Presence information of your subscription list (contacts with follow relationship). Done automatically upon registration
	@function
	@return void
	@example
ms.subscribe();
	*/
	MediaServices.prototype.subscribe = function() {
		var mediaService = this;
		
		var url = this._gwUrl + PRESENCE_RESOURCE + '/' + PRESENCE_RESOURCE_USER + '/' + PRESENCE_RESOURCE_USER_SUBSCRIBE;
		
		logger.log("Subscribing...");
		
		// Create and send a follow contact request
		var req = new _CreateXmlHttpReq();
		
		req.open("POST", url, true);
		req.setRequestHeader("Accept", "application/json, text/html");
		req.send(null);
	
		// On response
		req.onreadystatechange = function() {
			if (req.readyState == 4) {
				// Success response 201 Created
				if (req.status == 201) {
					logger.log("Subscribe successful");
				} else {
					var json = JSON.parse(req.responseText);
					logger.log("Subscribe failed: " + json.reason);
					_InternalError(mediaService, MediaServices.Error.NETWORK_FAILURE);
				}
			}
		};
	};
	
	/**
	Publish willingness, tagline and homepage
	@private
	*/
	MediaServices.prototype._publish = function(presenceData) {
		var mediaService = this;
		
		var url = this._gwUrl + PRESENCE_RESOURCE + '/' + PRESENCE_RESOURCE_USER + '/' + PRESENCE_RESOURCE_USER_PUBLISH;
		
		logger.log("Publishing services...");
		
		var body = {
			person : presenceData
		};
		
		// Create and send a follow contact request
		var req = new _CreateXmlHttpReq();
		
		req.open("POST", url, true);
		req.setRequestHeader("Accept", "application/json, text/html");
		req.setRequestHeader("Content-Type", "application/json");
		req.send(JSON.stringify(body, null, " "));
	
		// On response
		req.onreadystatechange = function() {
			if (req.readyState == 4) {
				// Success response 201 Created
				if (req.status == 201) {
					logger.log("Publish services successful");
				} else {
					var json = JSON.parse(req.responseText);
					logger.log("Publish services failed: " + json.reason);
					
					_InternalError(mediaService, MediaServices.Error.NETWORK_FAILURE);
				}
			}
		};
	};
	
	/**
	Set the avatar for self.
	@function
	@param {File} avatar Image avatar file 
	@param {Function} [callback] Success/failure callback function
	@throws {TypeError} Invalid avatar file
	@return void
	@example
var avatar = document.getElementById("avatar");
ms.setAvatar(avatar.files[0], function(evt) {
	if (evt.success == true) {
		// Set avatar successful
	} else if (evt.failure == true) {
		// Set avatar unsuccessful
	}
});
	*/
	MediaServices.prototype.setAvatar = function(avatar, callback) {
		if (!(avatar instanceof File)) {
			throw new TypeError("Invalid avatar file");
		}
		if (avatar.type.indexOf("image") != 0) {
			throw new TypeError("Invalid avatar file");
		}
	
		var url = this._gwUrl + CONTENT_RESOURCE + '/' + CONTENT_RESOURCE_SETAVATAR;
		
		var body = new FormData(); // Chrome 7+, Firefox 4+, Internet Explorer 10+, Safari 5+
		body.append("Filename", avatar.name);
		body.append("ClientId", this._sessionID);
		body.append("Filedata", avatar);
		body.append("Upload", "Submit Query");
		
		// Create and send a set avatar request
		var req = new _CreateXmlHttpReq();
		
		req.open("POST", url, true);
		req.setRequestHeader("Accept", "application/json, text/html");
		req.send(body);
	
		// On response
		req.onreadystatechange = function() {
			if (req.readyState == 4) {
				
				switch (req.status) {
					// Success response 201 Created (no previous avatar)
					case 201:
					// Success response 204 No Content
					case 204:
						logger.log("Set avatar successful");
						status = true;
				
						if (typeof(callback) == "function") {
							var event = {success : true, failure: false};
							callback(event);
						}
						break;
					default:
						var json = JSON.parse(req.responseText);
						logger.log("Set avatar failed: " + json.reason);
						
						if (typeof(callback) == "function") {
							var event = {success : false, failure: true};
							callback(event);
						}
						break;
				}
			}
		};
	};
	
	/**
	Delete the avatar for self.
	@function
	@return void
	@example
ms.deleteAvatar();
	*/
	MediaServices.prototype.deleteAvatar = function() {
		var mediaService = this;
		
		var url = this._gwUrl + CONTENT_RESOURCE + '/' + CONTENT_RESOURCE_DELETEAVATAR;
		
		// Create and send a set avatar request
		var req = new _CreateXmlHttpReq();
		
		req.open("DELETE", url, true);
		req.setRequestHeader("Accept", "application/json, text/html");
		req.send(null);
	
		req.onreadystatechange = function() {
			if (req.readyState == 4) {
				// Success respone 204 No Content
				if (req.status == 204) {
					logger.log("Delete avatar successful");
				} else {
					var json = JSON.parse(req.responseText);
					logger.log("Delete avatar unsuccessful" + json.reason);
					
					_InternalError(mediaService, MediaServices.Error.NETWORK_FAILURE);
				}
			}
		};
	};
	
	/**
	Publish services. Done automatically upon successful registration.
	TODO: keep this private? We only publish the services the user used on registration.
	@private
	*/
	MediaServices.prototype._publishServices = function() {
		var mediaService = this;
		
		var url = this._gwUrl + PRESENCE_RESOURCE + '/' + PRESENCE_RESOURCE_USER + '/' + PRESENCE_RESOURCE_USER_PUBLISH;
		
		logger.log("Publishing services...");
		
		var _services = [];
		var tokens = this.mediaType.replace(/(\s)/g, "").split(",");
		
		// Check which services the user registered with and publish those
		for (var i = 0; i < tokens.length; i++) {
			if (tokens[i] == "audio") {
				var service = SERVICE.VOICE_CALL;
				service.serviceStatus = "open";
				_services.push(service);
			} else if (tokens[i] == "video") {
				var service = SERVICE.VIDEO_CALL;
				service.serviceStatus = "open";
				_services.push(service);
			} else if (tokens[i] == "ftp") {
				var service = SERVICE.FILE_TRANSFER;
				service.serviceStatus = "open";
				_services.push(service);
			} else if (tokens[i] == "chat") {
				var service = SERVICE.MESSAGING_SESSION_MODE;
				service.serviceStatus = "open";
				_services.push(service);
			} else {
				// Invalid service
				_services = [];
				break;
			}
		}
		
		if (_services.length < 1) {
			throw new Error("Invalid user services");
		}
		
		var body = {
			services : _services
		};
		
		// Create and send a publish services request
		var req = new _CreateXmlHttpReq();
		
		req.open("POST", url, true);
		req.setRequestHeader("Accept", "application/json, text/html");
		req.setRequestHeader("Content-Type", "application/json");
		req.send(JSON.stringify(body, null, " "));
	
		// On response
		req.onreadystatechange = function() {
			if (req.readyState == 4) {
				// Success response 201 Created
				if (req.status == 201) {
					logger.log("Publish services successful");
				} else {
					var json = JSON.parse(req.responseText);
					logger.log("Publish services failed: " + json.reason);
					
					_InternalError(mediaService, MediaServices.Error.NETWORK_FAILURE);
				}
			}
		};
	};
	
	/**
	Clean parameters on deregistration.
	@private
	*/
	MediaServices.prototype._clean = function() {
		// Clear channel
		this._channel = null;
		
		// Clear peer connection
		if (this._call) {
			if (this._call._pc && this._call._pc.close) {
				this._call._pc.close();
				this._call._pc = null;
			}
			delete this._call;
			this._call = null;
		}
		
		// Clear the FileTransfer hashmap
		if (this._ftp) {
			this._ftp.clear();
			delete this._ftp;
			this._ftp = null;
		}
		
		// Clear contact list
		if (this._contactList) {
			delete this._contactList;
			this._contactList = null;
		}
		
		// Clear Chat hashmap
		if (this._chat) {
			this._chat.clear();
			delete this._chat;
			this._chat = null;
		}
	};
	
	/**
	Creates a new outgoing call object to a given recipient. The Call will be initialised, but will not ring until the {@link OutgoingCall#ring} method is called.
	@function
	@param {String} recipient An identifier denoting the callee. This can be a WebID, a SIP URI or a tel: URI
	@param {Object} [mediaType] Defines the getUserMedia() type of the Call. If specified, must be of format {audio:true} or {video:true} or {audio:true,video:true}. If unspecified, inherits the full set of media types of the MediaServices object.
	@return {OutgoingCall} A newly initialised OutgoingCall object
	@throws {Error} Recipient must be defined, and must be a string
	@throws {Error} Invalid media types
	@example
var call = ms.createCall("user2", {video:true});
call.onaddstream = function(evt) {};
call.onbegin = function(evt) {};
call.onend = function(evt) {};
call.onerror = function(evt) {};
call.onremovestream = function(evt) {};
call.onstatechange = function(evt) {};
call.ring();
	*/
	MediaServices.prototype.createCall = function(recipient, mediaType) {
		if (typeof(recipient) != "string" || recipient == "")
			throw new Error("Recipient must be defined, and must be a string");
		logger.log("MediaServices.prototype.createCall.... " );
		mediaType = _ParseMediaType(this, mediaType);
		
		this._call = new OutgoingCall(this, recipient, mediaType);
		this._call._isModerator = true;
		this._call._url = this._gwUrl + AUDIOVIDEO_RESOURCE;
		
		return this._call;
	};

	/**
	Create transfer call...
	@private	
	*/
	MediaServices.prototype._createTransferCall = function(recipient) {
		logger.log("MediaServices.prototype.createTransferCall.... " );
		this._transferTargetCall = new OutgoingCall(this, recipient, this._call.mediaType);
		this._transferTargetCall._url = this._gwUrl + AUDIOVIDEO_RESOURCE;
		this._transferTargetCall._isModerator = true;

		return this._transferTargetCall;
	};

	/**
	Creates a new conference object. The Conference object will be ready to begin, join or query.
	@function
	@param {String} [mediaType] Specifies the getUserMedia() type of the conference. If specified, must be of format {audio:true} or {video:true} or {audio:true,video:true}. If unspecified, inherits the full set of media types of the MediaServices object.
	@param {String} [confID] Identifies the conference ID to be joined (if already existing). If this parameter is absent, a new conference must be created but not joined.
	@return {Conference} A newly initialised Conference object
	@throws {Error} The conference must be named
	@throws {Error} Invalid media types
	@example
var conf = ms.createConference({audio:true});
conf.onaddstream = function(evt) {};
conf.onbegin = function(evt) {};
conf.onend = function(evt) {};
conf.onerror = function(evt) {};
conf.onremovestream = function(evt) {};
conf.onstatechange = function(evt) {};
conf.begin();
	*/
	MediaServices.prototype.createConference = function(mediaType, confID) {
		mediaType = _ParseMediaType(this, mediaType);
		
		var url = this._gwUrl + CONFERENCE_RESOURCE;

		this._call = new Conference(this, confID, url, mediaType);
		this._call._isModerator = true;
		
		return this._call;
	};
	
	/**
	Creates a new OutgoingFileTransfer object to a destination user.
	@function
	@param {String} destination The recipient of this file transfer. The destination has to be a Tel URI (e.g. tel:+491728885008) or Sip URI (e.g. sip:491728885008@mns.ericsson.ca).
	@return {OutgoingFileTransfer} A new OutgoingFileTransfer object
	@throws {Error} Invalid destination
	@example
var ftp = service.createFileTransfer("tel:+491728885008");
ftp.onstatechange = function(evt) {};
ftp.onerror = function(evt) {};
ftp.onuploadprogress = function(evt) {};
ftp.sendFile(file.files[0]);
	*/
	MediaServices.prototype.createFileTransfer = function(destination) {
		if (typeof(destination) != "string" || destination == "")
			throw new Error("Invalid destination");
		
		var ft = new OutgoingFileTransfer(this, destination);
		ft._url = this._gwUrl + FILETRANSFER_RESOURCE;
		
		return ft;
	};
	
	/**
	Creates a new chat session with a given recipient. The Chat object will be initialised.
	@function
	@param {String} recipient An identifier denoting the recipient of the message. This can be a WebID, a SIP URI or a TEL URI.
	@return {Chat} A newly initialised Chat object.
	@throws {Error} Invalid recipient
	@example
var chat = service.createChat("sip:491728885004@mns.ericsson.ca");
chat.onbegin = function(evt) {};
chat.onmessage = function(evt) {};
chat.oncomposing = function(evt) {};
chat.onerror = function(evt) {};
chat.onstatechange = function(evt) {};
	*/
	MediaServices.prototype.createChat = function(recipient){
		if (typeof(recipient) != "string" || recipient == "" || recipient == this.username)
			throw new Error("Invalid recipient");
		
		var chat = new Chat(this, recipient);
		
		chat._url = this._gwUrl + CHAT_RESOURCE;
		
		return chat;
	};
	
		/**
	Sends an instant message.
	@function
	@param {String} recipient An identifier denoting the recipient of the message. This can be a WebID, a SIP URI or a TEL URI.
	@param {String} The body of the message.
	@return void
	@throws {Error} Invalid recipient
	@example
var chat = service.createChat("sip:491728885004@mns.ericsson.ca");
chat.onbegin = function(evt) {};
chat.onmessage = function(evt) {};
chat.oncomposing = function(evt) {};
chat.onerror = function(evt) {};
chat.onstatechange = function(evt) {};
	*/
	MediaServices.prototype.sendIM = function(recipient, body){
		if (typeof(recipient) != "string" || recipient == "" || recipient == this.username)
			throw new Error("Invalid recipient");

		if(!body || typeof(body) != "string"){
			throw new Error("No body");
		}
		
		logger.log("Sending IM...");
		
		var messageURL = this._gwUrl + "message/send";
		
		// Create and send a create conference request
		var req = new _CreateXmlHttpReq();	
		var message = {
			to : recipient,
			body : body,
			contentType : "text/plain",
			type : "message"
		};
			
		req.open("POST", messageURL, true);
		req.setRequestHeader("Accept", "application/json, text/html");
		req.setRequestHeader("Content-Type", "application/json");
		req.send(JSON.stringify(message, null, " "));
	
		// On response
		req.onreadystatechange = function() {
			if (req.readyState == 4) {			
				if (req.status == 204) {
					logger.log("Send IM successful");
				} else {
					_InternalError(this, MediaServices.Error.NETWORK_FAILURE);
				}
			}
		};
	};
	
	/**
	Creates a new group chat object with a given subjet and a list of members. Invitations to join the group chat will be sent upon calling {GroupChat#start}.
	@function
	@param {String} subject The subject title of this group chat conference
	@param {Array} members A list of members to be invited to this group chat session
	@return {GroupChat} A newly initialised GroupChat object.
	@throws {Error} Invalid subject
	@throws {Error} Invalid recipients
	@throws {Error} No recipients
	@example
var groupchat = service.createGroupChat("This is a new group chat!", ["sip:491728885004@mns.ericsson.ca", "sip:491728885005@mns.ericsson.ca"]);
groupchat.onbegin = function(evt) {};
groupchat.onmessage = function(evt) {};
groupchat.oncomposing = function(evt) {};
groupchat.onerror = function(evt) {};
groupchat.onstatechange = function(evt) {};
groupchat.onupdate = function(evt) {};
groupchat.onend = function(evt) {};
groupchat.start();
	*/
	MediaServices.prototype.createGroupChat = function(subject, members) {
		if (typeof(subject) != "string" || subject == "") {
			throw new Error("Invalid subject");
		}
		if (typeof(members) != "object" || !members || members.length == 0) {
			throw new Error("Invalid recipients");
		}
		
		if (members.indexOf(this.username) > -1) {
			members.splice(members.indexOf(this.username), 1);
			if (members.length == 0)
				throw new Error("No recipients");
		}
		
		var groupChat = new GroupChat(this, subject, members, this.username);
		
		groupChat._url = this._gwUrl + GROUP_CHAT_RESOURCE;
		groupChat._isOwner = true;
		
		return groupChat;
	};
	
	// Callback functions for MediaServices
	/**
	Called when the MediaServices object is ready to use.
	@event 
	@type function
	@param evt
	@example
ms.onready = function(evt) {
	// Media service is ready to use.
};
	*/
	MediaServices.prototype.onready = function(evt){}; // The MediaServices object is ready to use
	
	/**
	Called when MediaServices has encountered an error
	@event 
	@type function
	@param evt Error event
	@param {String} evt.type "error"
	@param {MediaServices.Error} evt.reason Error code
	@param {MediaServices} evt.target Proximal event target
	@example
var ms = new MediaServices(...);
ms.onerror = function(evt) {
	switch (evt) {
		case MediaServices.Error.NETWORK_FAILURE:
			// Handle
			break;
		case MediaServices.Error.INVALID_CREDENTIALS:
			// Handle
			break;
		// ...
	}
};
	*/
	MediaServices.prototype.onerror = function(evt){}; // An error occurred. See the event for details.
	
	/**
	Called when the MediaServices object has closed in an orderly fashion.
	@event 
	@type function
	@param evt
	@example
ms.onclose = function(evt) {
	// Media service has closed properly.
};
	*/
	MediaServices.prototype.onclose = function(evt){}; // The session has ended and this MediaServices object is no longer available to use
	
	/**
	Called when MediaServices changes its state.
	@event
	@type function
	@param evt Event describing the state change
	@param {Call.State} evt.newState New state
	@param {Call.State} evt.oldState Old state
	@example
ms.onstatechange = function(evt) {
	switch (evt.newState) {
		case MediaServices.State.INITIALISED:
			// Call state has changed to READY
			break;
		case MediaServices.State.REGISTERING:
			// Call state has changed to ENDED
			break;
		// ...
	}
};
	*/
	MediaServices.prototype.onstatechange = function(evt){}; // The MediaServices object has changed state
	
		/**
	Called when the MediaServices has and instant Message (IM) event.
	@event 
	@type function
	@param evt
	@example
ms.onimresult = function(evt) {
	// Media service is ready to use.
};
	*/
	MediaServices.prototype.oninstantmessage = function(evt){}; // The MediaServices object is ready to use
	
	/**
	Called when the MediaServices object receives a remote media event such as an incoming call, a conference invitation, a file transfer request, a chat message or a group chat request.
	@event
	@type function
	@param evt
	@param {IncomingCall} evt.call An IncomingCall object
	@param {Conference} evt.conf A Conference object
	@param {IncomingFileTransfer} evt.ftp An IncomingFileTransfer object
	@param {Chat} evt.chat A Chat object
	@param {GroupChat} evt.groupChat A GroupChat object
	@example
ms.oninvite = function(evt) {
	if (evt.call) {
		// We have an incoming call
		// This is a regular IncomingCall object that can be freely manipulated.
		evt.call.answer();
	} else if (evt.conf) {
		// Invited to a conf
		evt.conf.join();
	} else if (evt.ftp) {
		evt.ftp.accept();
		// or
		evt.ftp.cancel();
	} else if (evt.chat) {
		evt.chat.onbegin = function() {};
		evt.chat.onmessage = function() {};
	} else if (evt.groupChat) {
		evt.groupChat.accept();
		// or
		evt.groupChat.decline();
	}
};
	*/
	MediaServices.prototype.oninvite = function(evt){}; // An invitation to a call/conference has been received
	
	/**
	Call is a generic handler for calls. The abstract Call object handles signaling and termination of calls. These calls
	can be sessions to a conference or to another user. This is a private constructor.
	@class Call is a generic handler for calls and includes all methods for dealing with an ongoing call. The abstract Call 
	object can handle signaling and termination of calls.  These calls can be sessions to a conference or to another user. 
	For outgoing calls to other recipients, see {@link OutgoingCall}. For incoming calls from other users, see {@link IncomingCall}. <br />
	@property {Call.state} state The call's current state (read only).
	@property {MediaStream[]} localStreams Contains a list of local streams being sent on this call (read only).
	@property {MediaStream[]} remoteStreams Contains a list of remote streams being received on this call (read only).
	@property {String} mediaType Type of media for this call. This field can be changed until media has been established.
	@param {MediaServices} mediaServices The object that created this Call object.
	@param {String} recipient Call recipient
	@param {String} mediaType Media types supported in this call (e.g. "audio", "video" or "audio,video").
	*/
	Call = function(mediaServices, recipient, mediaType) {
		var _state= Call.State.READY;
		
		/**
		@field mediaType
		Call media type 
		*/
		Object.defineProperty(this, "mediaType", {
			get: function() { return mediaType; },
			set: function(newType) { 
				if (this._pc != null) 
					throw "Cannot change media type after established media.";
				mediaType = newType;
			}
		});

		/**
		@field state
		Call state
		*/
		Object.defineProperty(this, "state", {
			get: function()
			{
				return _state;
			},
			
			set: function(newState)
			{
				_state = newState;
				
				var evt = {type: "statechange", oldState : _state, state: newState};
				if (typeof(this.onstatechange) == "function") {
					this.onstatechange(evt);
				}					
				
				// Dispatch appropriate states
				switch (newState) {
					case Call.State.RINGING:
						if (this instanceof IncomingCall) {
							var evt = { call: this, conf: null };
							if (typeof(mediaServices.oninvite) == "function") { mediaServices.oninvite(evt); }
						}
						break;
					case Call.State.ONGOING:
					case Conference.State.IN_PROGRESS:
						if (typeof(this.onbegin) == "function") { this.onbegin(evt); }
						break;
					default:
						break;
				}
			}
		});

		/**
		@field remoteStreams
		Remote streams of the call
		*/
		Object.defineProperty(this, "remoteStreams", {
			get: function() {
				if (this._pc) { return this._pc.remoteStreams; }
				else { return []; }
			}
		});

		/**
		@field localStreams
		Local streams of the call
		*/
		Object.defineProperty(this, "localStreams", {
			get: function() {
				if (this._pc) { return this._pc.localStreams; }
				else { return []; }
			}
		});
		
		/**
		Call/conference recipients
		@private
		*/
		this.recipient = recipient;
		
		/**
		Media service object
		@private
		*/
		this._mediaServices = mediaServices;
		
		/**
		is RTC peer connection (JSEP latest)
		@private
		*/
		this.isRTCConnection = true;

		/**
		is RTC but with Mozilla (partly JSEP?)
		@private
		*/
		this.isMozillaConn = false;
		
		/**
		is detected to be a breakout call
		@private
		*/
		this.isBreakout = false;		
		
		/**
		Base URL including session ID ("baseURL"/"sessionID"/)
		@private
		*/
		this._url = null;
		
		/**
		Session modification ID
		@private
		*/
		this._modID = null;
						
		/**
		Role of the user (Moderator or Normal user)
		@private
		*/
		this._isModerator = null;

		/**
		Role of the user (Moderator or Normal user)
		@private
		*/
		this._isModifModerator = null;

		/**
		A reference to the local PeerConnection object. The call re-exposes the relevant elements.
		@private
		*/
		this._pc = null;
		
		/**
		Current call ID
		@private
		*/
		this._callID = null;
		
		/**
		Remote SDP object
		@private
		*/
		this._sdp = {};
		
		/**
		Array of Ice candidates
		@private
		*/
		this._candidates = [];
		
		/**
		Has OFFER been sent
		@private
		*/
		this._isSignalingSent = false;
		
		/**
		Mod ID
		@deprecated Not used for JSEP. To remove when ROAP is no longer supported.
		@private
		*/
		this._DEPRECATEDmodID = null;
		
		/**
		ROAP handling object
		@deprecated Not used for JSEP. To remove when ROAP is no longer supported.
		@private
		*/
		this._DEPRECATEDroap = new _DEPRECATEDRoap();
		return this;
	};
	
	/**
	@namespace Describes the possible states of the call object.
	*/
	Call.State = {};
	
	/**
	Notifies that call object is ready for outgoing calls
	*/
	Call.State.READY = 0;
	
	/**
	Notifies that call object is ringing; an incoming call needs to be answered or an outgoing call needs the remote side to answer
	*/
	Call.State.RINGING = 1;
	
	/**
	Notifies that call object is in progress and media is flowing
	*/
	Call.State.ONGOING = 2;
	
	/**
	Notifies that call object is on hold.
	*/
	Call.State.HOLDING = 5;
	
	/**
	Notifies that call was put on Hold by the other side.
	*/
	Call.State.WAITING = 6;
	
	/**
	Notifies that call object has ended normally; the call was terminated in an expected and controlled manner
	*/
	Call.State.ENDED = 3;
	
	/**
	Notifies that call object has ended with an error; the call was terminated in an unexpected manner (see {@link Call.Error} for more details)
	*/
	Call.State.ERROR = 4;
	
	/**
	@namespace Describes the possible errors of the call object.
	*/
	Call.Error = {};
	
	/**
	General network failure
	*/
	Call.Error.NETWORK_FAILURE = 0;
	
	/**
	Peer Connection setup failure
	*/
	Call.Error.PEER_CONNECTION = 1;
	
	/**
	Webkit media error
	*/
	Call.Error.USER_MEDIA = 2;
	
	/**
	Invalid user error
	*/
	Call.Error.INVALID_USER = 3;	
	
	Call.prototype.isConference = function() { return false;};
	
	/**
	Gets the string representing the State ID. This can be called at any time and is useful for debugging
	@return {String} State A string representing the state of the Call 
	@example
call.getStringState();
	*/
	Call.prototype.getStringState = function() {
	switch (this.state) {
	case Call.State.READY:
		return "READY";
		break;
	case Call.State.RINGING:
		return "RINGING";
		break;
	case Call.State.ONGOING:
		return "ONGOING";
		break;
	case Call.State.HOLDING:
		return "HOLDING";
		break;
	case Call.State.WAITING:
		return "WAITING";
		break;
	case Call.State.ENDED:
		return "ENDED";
		break;
	default:
		return "ERROR";
		break;
	}
	};

	/**
	Creates a Peer Connection and triggers signaling when ready
	@deprecated Not used for JSEP. To remove when ROAP is no longer supported.
	@private
	*/
	Call.prototype._DEPRECATEDcreatePeerConnection = function(callback, roapMessage) {
		var mt = this;
		
		navigator.webkitGetUserMedia('audio, video', function(stream) {
			var turnConf= mt._mediaServices.turnConfig.replace('stun:', 'STUN '); 
			try {
				mt._pc = new webkitDeprecatedPeerConnection(turnConf, function(sig) {
				
					logger.log("turnConfig: " + turnConf + "   sig: " + sig);
					mt._DEPRECATEDsendSignaling(sig, function(event) {
						if (typeof(callback) == "function") {
							callback(event);
						}
					});
				});
			} catch (e) {	
				mt._pc = new webkitPeerConnection00(turnConf, function(sig) {
					logger.log("turnConfig: " + turnConf + "   sig: " + sig);
					mt._DEPRECATEDsendSignaling(sig, function(event) {
						if (typeof(callback) == "function") {
							callback(event);
						}
					});
				});
			}
			
			// Add the local stream
			mt._pc.addStream(stream);
			
			// Propagate the event
			mt._pc.onaddstream = function(evt) { if (typeof(mt.onaddstream) == "function") { evt.call = mt; mt.onaddstream(evt);} };
			mt._pc.onremovestream = function(evt) { logger.log("ONREMOVESTREAM"); if (typeof(mt.onremovestream) == "function")  { evt.call = mt; mt.onremovestream(evt);} };
			mt._pc.onclose = function() { mt.onend(); };
			mt._pc.onopen = function() { mt.state = Call.State.ONGOING; };
			logger.log("Event propagated");
			
			if (roapMessage) {
				// Signal the ANSWER
				mt._pc.processSignalingMessage(roapMessage);
			}
		}, function(error) {
			logger.log("Error obtaining user media: " + error.toString());
			
			var callType = (mt instanceof Conference) ? Conference : Call;
			_InternalError(mt, callType.Error.USER_MEDIA);
		});
	};
	
	/**
	H2S signalling
	@deprecated Not used for JSEP. To remove when ROAP is no longer supported.
	@private
	*/
	Call.prototype._DEPRECATEDsendSignaling = function(sig, callback) {
		var _call = this;
		
		var roap = this._DEPRECATEDroap.parseROAP(sig);
		var url = this._url;
		var callType = (_call instanceof Conference) ? Conference : Call;
		logger.log("Roap Message Type: " + roap.messageType);
		if (roap.messageType == "OFFER") {
			logger.log("Got OFFER");
			
			if (this instanceof Conference && !this.confID) {
				// Starting a new conference
				var req = new _CreateXmlHttpReq();
				
				req.open("POST", url, true);
				req.setRequestHeader("Content-Type", "application/json");
				req.setRequestHeader("Accept", "application/json, text/html");
				req.send(JSON.stringify(roap.SDP, null, " "));
				req.onreadystatechange = function() {
					if (req.readyState == 4) {
						
						var json = JSON.parse(req.responseText);
						
						// Success response 202 Accepted
						if (req.status == 202) {
							// Get the conference ID
							var tokens = json.resourceURL.split("/");
							var index = tokens.indexOf("mediaconf");
							_call.confID = tokens[index + 1];
							
							var event = {success : true, failure: false};
							callback(event);
						} else {
							var event = {success : false, failure: true};
							callback(event);
						}
					}
				};
			} else {
				// Audio video invite
				var body = {
					to : this.recipient,
					sdp : roap.SDP.sdp,
					v : roap.SDP.sdp.v,
					o : roap.SDP.sdp.o,
					s : roap.SDP.sdp.s,
					t : roap.SDP.sdp.t
				};
				
				var req = new _CreateXmlHttpReq();
				if(!_call._isModerator){
					//var roapsdp = "v=0\r\no=- 0 0 IN IP4 127.0.0.1\r\ns=\r\nt=0 0\r\n";
					for(mediaIndex in roap.SDP.sdp) {
					   if(roap.SDP.sdp[mediaIndex].c == ""){
						  roap.SDP.sdp[mediaIndex].c= "IN IP4 10.10.0.55";
					   }
					}

					body.v= "0";
					body.o= "- 0 0 IN IP4 127.0.0.1";
					body.s= "";
					body.t= "0 0";
					
					url= url + "/mod";
				}				
				
				var stringBody= JSON.stringify(body, null, " ");
				stringBody= stringBody.replace("RTP/AVPF", "RTP/AVP");
				stringBody= stringBody.replace("ulpfec", "H264");
				logger.log("about to send SDP: " + stringBody);

				req.open("POST", url, true);
				req.setRequestHeader("Content-Type", "application/json");
				req.setRequestHeader("Accept", "application/json, text/html");
				req.send(stringBody);
			
				// On response
				req.onreadystatechange = function() {
					if (req.readyState == 4) {
						var json = JSON.parse(req.responseText);
						
						// Success response 202 Accepted
						if (req.status == 202 || req.status == 201) {
							logger.log("Audio video invite: " + json.state);
						} else {
							logger.log("Audio video invite unsuccessful: " + req.status + " " + json.reason);
							
							if (req.status == 400) {
								throw new Error("User not found");
							} else {
								_InternalError(_call, callType.Error.NETWORK_FAILURE);
							}
						}
					}
				};
			}
		} else if (roap.messageType == "ANSWER") {
			logger.log("Got ANSWER");
			
			if (this._modID) {
				url += "/mod/" + this._modID;
			}
			
			var req = new _CreateXmlHttpReq();
							
			var stringBody= JSON.stringify(roap.SDP, null, " ");
			stringBody= stringBody.replace("RTP/AVPF", "RTP/AVP");
			stringBody= stringBody.replace("ulpfec", "H264");
			logger.log("about to send SDP: " + stringBody);

			req.open("POST", url, true);
			req.setRequestHeader("Content-Type", "application/json");
			req.setRequestHeader("Accept", "application/json, text/html");
			req.send(stringBody);
			
			// On response
			req.onreadystatechange = function() {
				if (this.readyState == 4) {
					var json = JSON.parse(req.responseText);
					
					// Success response 200 OK
					if (req.status == 200) {
						logger.log("Accept invite: " + json.state);
					} else {
						logger.log("Accept invite unsuccessful: " + json.reason);
						_InternalError(_call, callType.Error.NETWORK_FAILURE);
					}
				}
			};
		} else if (roap.messageType == "OK") {
			logger.log("Got OK");
			
			if (_call instanceof Conference) {
				_call.state = callType.State.IN_PROGRESS;
			} else {
				_call.state = callType.State.ONGOING;
			}
		} else {
			logger.log("Got ERROR");
			logger.log(roap);
			throw new Error("Failed to setup peer connection");
		}
	};

	/**
	Terminates all media in the call. This can be called at any time
	@return void
	@throws {Error} No active call to end
	@example
call.end();
	*/
	Call.prototype.end = function() {
		var _call = this;
		var audiovideoURL = this._url;
		

		
		logger.log("Leaving call...");
		
		// Create and send a create conference request
		var req = new _CreateXmlHttpReq();
		
		req.open("DELETE", audiovideoURL, true);
		req.setRequestHeader("X-http-method-override", "DELETE");
		req.send(null);
	
		// On response
		req.onreadystatechange = function() {
			if (req.readyState == 4) {
				// Success response 204 No content
				if (req.status == 204) {
					logger.log("Leave call successful");
					
					// Clear moderator flag
					_call._isModerator = null;
					_call._callID = null;

					_call.state = Call.State.ENDED;
					if (typeof(_call.onend) == "function") { 
						_call.onend({reason: "Call terminated"}); 
					}
					  
				} else {
					var json = JSON.parse(req.responseText);
					logger.log("Leave call unsuccessful: " + json.reason);
					
					// 403 Forbidden, Call-ID does not exist
					if (req.status == 403) {
						throw new Error("No active call to end");
					} else if (req.status == 405) {
						logger.log("Rest call returned "+req.status+" : No active call to end");
					} else {
						_InternalError(_call, Call.Error.NETWORK_FAILURE);
					}
				}
			}
		};
		
		_call._modID= null;

		if (this._pc && this._pc.close) {
			logger.log("close peer connection");
			this._pc.close();
		}
		
		this._pc = null;
	};
	
	function _updateSdp(sdp, oldString, newString) {	
		var indexof= sdp.indexOf(oldString);
		if(indexof > 0){
			var prefix= sdp.substr(0, indexof);
			var remaining= sdp.substr(indexof + oldString.length);
			return prefix + newString + remaining;
		} else {
			return sdp;
		}
	};

	/**
	Put the call on hold. This can be called at any time
	@return void
	@throws {Error} No active call to hold
	@example
call.hold();
	*/
	Call.prototype.hold = function() {
		if(this.state == Call.State.ONGOING){
			logger.log("Put call on hold...");
			this._modify("hold");
		}
	};
	
	/**
	Resume the call. This can be called at any time
	@return void
	@throws {Error} No active call to resume
	@example
call.resume();
	*/
	Call.prototype.resume = function() {
		if(this.state == Call.State.HOLDING){
			logger.log("Resume the call...");
			this._modify("resume");
		}
	};
	
	/**
	Modify the call.
	@private
	*/
	Call.prototype._modify = function(action) {

		var _call = this;
		var audiovideoURL = this._url + '/mod';
		_call._isModifModerator= true;
		var req = new _CreateXmlHttpReq();
		var newsdp;

		if(action == "resume"){
			newsdp= _updateSdp(_call._sdp.sdp, "sendonly", "sendrecv"); //audio
			newsdp= _updateSdp(newsdp, "sendonly", "sendrecv"); //video
		} else {
			newsdp= _updateSdp(_call._sdp.sdp, "sendrecv", "sendonly"); //audio
			newsdp= _updateSdp(newsdp, "sendrecv", "sendonly"); //video
		}
		newsdp= incrementSdpVersion(newsdp);
		
		_call._sdp.sdp = newsdp;
		var descriptor = {
			sdp: newsdp,
			type: "offer"
		};
		
		var modifyLocalDescriptor= new RTCSessionDescription(descriptor, null,function(err){ console.log("Err newsdp " + err);});
		_call._pc.setLocalDescription(modifyLocalDescriptor);
		var body = _ParseSDP(null, newsdp);
			  
		req.open("POST", audiovideoURL, true);
		req.setRequestHeader("Content-Type", "application/json");
		req.setRequestHeader("Accept", "application/json, text/html");
		req.send(JSON.stringify(body, null, " "));
	
		// On response
		req.onreadystatechange = function() {
			if (req.readyState == 4) {
				// Success response 204 No content
				if (req.status >= 200 && req.status <= 204) {
					logger.log(action + " call successful");	
					if(action == "resume"){
						_call.state = Call.State.ONGOING;
					} else {
						_call.state = Call.State.HOLDING;					
					}
				} else {
					var json = JSON.parse(req.responseText);
					logger.log(action + " call unsuccessful: " + json.reason);
					
					// 403 Forbidden, Call-ID does not exist
					if (req.status == 403) {
						throw new Error("No active call to end");
					} else {
						_InternalError(_call, Call.Error.NETWORK_FAILURE);
					}
				}
			}
		};
	};
	
	function incrementSdpVersion(sdp){
		var oLineBeginIndex= sdp.indexOf("o=");
		var before= sdp.substr(0, oLineBeginIndex);
		var oLine= sdp.substr(oLineBeginIndex);
		var oLineEndIndex= oLine.indexOf("\r\n");
		var after= oLine.substr(oLineEndIndex);
		oLine= oLine.substr(0, oLineEndIndex);
		var o_values = oLine.split(" ");
		o_values[2] ++;
		return before + o_values.join(" ") + after;
	}
	
	function delayTransferBecauseOfMTASBug(_call, transferToCall, event){
		console.log("Performing transfer from " + _call._callID  + " to " + transferToCall._callID);
		var audiovideoURL = _call._url + '/transfer/' + transferToCall._callID;
		
		var req = new _CreateXmlHttpReq();
		req.open("POST", audiovideoURL, true);
		req.setRequestHeader("Accept", "application/json, text/html");
		req.send(null);
	
		// On response
		req.onreadystatechange = function() {
			if (req.readyState == 4) {
				// Success response 204 No content
				if (req.status >= 200 && req.status <= 204) {
					logger.log("Sending transfer request");					
				} else {
					var reason= "unknown, status= " + req.status;
					if(req.responseText != "") {reason = JSON.parse(req.responseText).reason;}						
					logger.log("Transfer call unsuccessful: " + reason);
					transferToCall.end();
					throw new Error("Fail to transfer the call to " + transferaddress);
				}
			}
		};
	}
	
	/**
	Transfer the call to another address. This can be called at any time
	@return void
	@throws {Error} No active call to transfer
	@example
call.transferto(transferaddress);
	*/
	Call.prototype.transferto = function(transferaddress) {

		var _call = this;
		if(_call.state != Call.State.HOLDING){
			console.log("Call is not on hold cannot transfer.");
		}
		
		//Make second call to transferaddress
		transferToCall = _call._mediaServices._createTransferCall(transferaddress);
		transferToCall.onaddstream = function (event) {console.log("Got transferTarget media stream");};
		transferToCall.onbegin = function (event) {
			console.log("TransferTarget connected");
			setTimeout(delayTransferBecauseOfMTASBug, 6000, _call, transferToCall, event);
		};
		transferToCall.onend = function (event) {console.log("TransferTarget call has ended.");};
		transferToCall.onerror = function (event) {console.log("TransferTarget call error ending transfer."); transferToCall.end();};
		transferToCall.onremovestream = function(event){};
		transferToCall.onstatechange =  function(event){console.log("TransferTarget new state " + transferToCall.getStringState());};
		transferToCall.ring();
	};
	
	var nCand = 0;
    var sendTimer = -1;
    function sendSdp(mt) {
        if (!mt._isSignalingSent) {
			mt._isSignalingSent = true;
			sendTimer = -1;
			
			// test of parse+restore
			//var sdp_orig=mt._sdp.sdp;
			//logger.log(sdp_orig);
			//var sdpObj = _MozParseSDP(null, sdp_orig);
			//var sdp_restored = _MozSDPToString(undefined, sdpObj.sdp);
			//logger.log(sdp_restored);
			
			
			// epetstr mt._pc.localDescription is null in FF
			//mt._sendSignaling(mt._pc.localDescription.type, mt._pc.localDescription.sdp);
			mt._sendSignaling(mt._sdp.type, mt._sdp.sdp);
			
			// epetstr mt._pc.localDescription is null in FF
			//mt._sdp.sdp= mt._pc.localDescription.sdp;
        }
    }

	/**
	Creates a Peer Connection and triggers signaling when ready
	@private
	*/
	Call.prototype._createPeerConnection = function(callback) {
		var mt = this;
		logger.log("in createPeerConnection " + callback);
		
		// Get the user's media
		navigator.webkitGetUserMedia(mt.mediaType, function(stream) {
			try {
			   console.log("Turnconfig: " + mt._mediaServices.turnConfig);
			    //var pc_config = {"iceServers": [{"url": mt._mediaServices.turnConfig}]};
			    pc_config = {};
			    pc_config.iceServers = [{"url": mt._mediaServices.turnConfig, "credentials" : null}];
				mt._pc = new webkitRTCPeerConnection(pc_config);
				mt._pc.onicecandidate= function(event) {
					// Get all candidates before signaling
					if (event.candidate != null) {
						console.log("onicecandidate called: " + JSON.stringify(event.candidate));
						nCand++;
						console.log("nr of gathered candidates: " + nCand);
						if (sendTimer == -1) sendTimer = setTimeout(sendSdp, 5000, mt);
					} else if (!mt._isSignalingSent) {
						clearTimeout(sendTimer);
						sendSdp(mt);
					}
				};
			} catch (e) {
				console.log("catched exception in webkitGetUserMedia callback function: " + e.message);
				mt.isRTCConnection= false;
				var turnConf= mt._mediaServices.turnConfig.replace('stun:', 'STUN ') ;
				// Create new PeerConnection
				mt._pc = new webkitPeerConnection00(turnConf, function(candidate, moreToFollow) {
					// Get all candidates before signaling
					if (candidate) {
						mt._sdp.sdp.addCandidate(candidate);
					}
					
					if (!moreToFollow && !mt._isSignalingSent) {
						mt._sendSignaling(mt._sdp.type, mt._sdp.sdp.toSdp());						
						mt._isSignalingSent = true;
					}
				});

			}

			// Add the local stream
			mt._pc.addStream(stream);
			
			// Propagate the event
			mt._pc.onaddstream = function(evt) { if (typeof(mt.onaddstream) == "function") { evt.call = mt; mt.onaddstream(evt);} };
			mt._pc.onremovestream = function(evt) { logger.log("ONREMOVESTREAM"); if (typeof(mt.onremovestream) == "function")  { evt.call = mt; mt.onremovestream(evt);} };
			mt._pc.onclose = function() { mt.onend({reason: "Terminated"}); };
			mt._pc.onconnecting = function() { console.log("peer connecting !"); };
			mt._pc.onopen = function() { if(mt.state != Call.State.WAITING && mt.state != Call.State.HOLDING) mt.state = Call.State.ONGOING;};
			
			if (typeof(callback) === "function") {
				callback();
			}
		}, function(error) {
			logger.log("Error obtaining user media: " + error.toString());
			
			var callType = (mt instanceof Conference) ? Conference : Call;
			_InternalError(mt, callType.Error.USER_MEDIA);
		});
	};

	/**
	Creates a Peer Connection and triggers signaling when ready
	@private
	*/
	Call.prototype._createMozPeerConnection = function(callback) {
		var mt = this;
		logger.log("in createMozPeerConnection " + callback);
		
		// Get the user's media
		if (!mt.mediaType.audio) {
			var errstr = "at least audio have to be selected (video is optional)";
			console.log(errstr);
			throw errstr;
		}
		
		navigator.mozGetUserMedia({audio:true}, function(audiostream) {
												// audio OK
			if (typeof(mt.onaddlocalstream) == "function")  {
				var event = {};
				event.stream = audiostream;
				event.type = "audio";
				mt.onaddlocalstream(event);
			}
			
			if (mt.mediaType.video) { 
				navigator.mozGetUserMedia({video:true}, function(videostream) {
														// video OK
					if (typeof(mt.onaddlocalstream) == "function")  {
						var event = {};
						event.stream = videostream;
						event.type = "video";
						mt.onaddlocalstream(event);
					}
					// we have audio+video streams
					mt._createMozPeerConnectionHelper(callback, audiostream, videostream);
				}, Call._userMediaError); // Fail
			} else {
				// we have audiostream only
				mt._createMozPeerConnectionHelper(callback, audiostream);
			}
		}, Call._userMediaError); // Fail	
	}
	
	Call._userMediaError = function(error) {
		if (typeof e == typeof {}) {
			console.log("Error in call setup" + ": " + JSON.stringify(e));
			//console.log(contextmsg + ": " + JSON.stringify(e));
		} else {
			console.log("Error in call setup" + ": " + e);
			//console.log(contextmsg + ": " + e);
		}
		// is this the reason for the 405 loop...??
		//this.end(); // dont know if this is appropriate since there is no call
	}
	
	/**
	Helper function used when to setup callbacks etc when stream(s) are ready
	video stream argument may be null
	@private
	*/
	Call.prototype._createMozPeerConnectionHelper = function(callback, audiostream, videostream) {
		var mt = this; // I know mt variable not needed in this helper function but stil convenient due to similarity to chrome createPerConnection
		console.log("Turnconfig: " + mt._mediaServices.turnConfig);

		//  standard complient config (since 29 jan version of FF)
		var pc_config = {"iceServers": [{"url": mt._mediaServices.turnConfig}]};
		console.log("pc_config:"+JSON.stringify(pc_config));
		mt._pc = new mozRTCPeerConnection(pc_config);

		// Add the local streams
		mt._pc.addStream(audiostream);
		if (mt.mediaType.video) {
			mt._pc.addStream(videostream);
		}
		
		
		mt._pc.onicecandidate= function(event) {
			console.log("pc.onicecandidate called");
		};

		// Propagate the event
		mt._pc.onaddstream = function(evt) { 
			console.log("pc.onaddstream called "+evt.type);
			if (typeof(mt.onaddstream) == "function") { 
				//evt.call = mt;
				console.log("found pc.onaddstream callback "+evt.type);
				mt.onaddstream(evt);
			}
			// special handling for FF since onopen is never called
			// this statechange will indirectly call onbegin callback
			if(mt.state != Call.State.WAITING)
				mt.state = Call.State.ONGOING;
		};

		mt._pc.onremovestream = function(evt) { 
			logger.log("pc.onremovestream called"); 
			if (typeof(mt.onremovestream) == "function")  { 
				//evt.call = mt; 
				mt.onremovestream(evt);
			} 
		};



		mt._pc.onstatechange = function(obj) {
			console.log("onstatechange with " + obj);
		};

		mt._pc.ongatheringchange = function(obj) {
			console.log("ongatheringchange with " + obj);
		};

		mt._pc.onicechange = function(obj) {
			console.log("onicechange with " + obj);
		};


		// MOZFIX : NS_ERROR_XPC_CANT_MODIFY_PROP_ON_WN: Cannot modify properties of a WrappedNative
		// MOZFIX mt._pc.onclose = function() { mt.onend(); };
		// MOZFIX mt._pc.onconnecting = function() { console.log("peer connecting !"); };
		mt._pc.onopen = function() { 
			if(mt.state != Call.State.WAITING) 
				mt.state = Call.State.ONGOING;
		};

		if (typeof(callback) === "function") {
			callback();
		}
	};
	

	
	
	/**
	WCG signalling
	@private
	*/
	Call.prototype._sendSignaling = function(type, sdp) {
		var _call = this;
		var url = this._url;
				
		if (type == "OFFER" || type == "offer") {
			logger.log("Sending OFFER");
			
			if (this instanceof Conference && !this.confID) {
				var body = _ParseSDP(null, sdp);
				
				// Starting a new conference
				var req = new _CreateXmlHttpReq();
				
				req.open("POST", url, true);
				req.setRequestHeader("Content-Type", "application/json");
				req.setRequestHeader("Accept", "application/json, text/html");
				req.send(JSON.stringify(body, null, " "));
				req.onreadystatechange = function() {
					if (req.readyState == 4) {
						
						var json = JSON.parse(req.responseText);
						
						// Success response 201 Created
						if (req.status == 201) {
							var tokens = req.getResponseHeader ("Location").split("/");
							var index = tokens.indexOf("mediaconf");
							_call.confID = tokens[index + 1];
							_call._url+= "/" +  tokens[index + 1];						
						} else {
							_InternalError(_call, _call.Error.NETWORK_FAILURE);
						}
					}
				};
			} else {
				// Audio video invite

				// determine if this a breakout call
				console.log("Call recipient:"+this.recipient);
				if (this.recipient.length > 5 && this.recipient.charAt(4) == '+') {
					this.isBreakout = true;
					console.log("This is a breakout call");
					var body = _ParseSDP(this.recipient, sdp);
				} else {
					var body = _MozParseSDP(this.recipient, sdp);
				}
				
				var req = new _CreateXmlHttpReq();
				req.open("POST", url, true);
				req.setRequestHeader("Content-Type", "application/json");
				req.setRequestHeader("Accept", "application/json, text/html");
				req.send(JSON.stringify(body, null, " "));
			
				// On response
				req.onreadystatechange = function() {
					if (req.readyState == 4) {
						var json = JSON.parse(req.responseText);
						
						// Success response 201 Created
						if (req.status >= 200 && req.status <= 204) {
							var tokens = req.getResponseHeader ("Location").split("/");
							var index = tokens.indexOf("audiovideo");
							_call._callID=tokens[index + 1];
							_call._url+= "/" +  tokens[index + 1];						
							logger.log("Audio video invite: " + json.state);
						} else {
							logger.log("Audio video invite unsuccessful: " + json.reason);
							
							if (req.status == 400) {
								_InternalError(_call, Call.Error.INVALID_USER);
							} else {
								_InternalError(_call, Call.Error.NETWORK_FAILURE);
							}
						}
					}
				};
			}
		} else if (type == "ANSWER" || type == "answer") {
			logger.log("Sending ANSWER");
			
			if(this._modID != null){
				url += "/mod/" + this._modID;
			}
			
			//var body = _ParseSDP(null, sdp);
			var body = _MozParseSDP(null, sdp);
			
			var req = new _CreateXmlHttpReq();
			
			req.open("POST", url, true);
			req.setRequestHeader("Content-Type", "application/json");
			req.setRequestHeader("Accept", "application/json, text/html");
			req.send(JSON.stringify(body, null, " "));
			
			// On response
			req.onreadystatechange = function() {
				if (this.readyState == 4) {
					var json = JSON.parse(req.responseText);
					
					// Success response 200 OK
					if (req.status == 200) {
						logger.log("Accept invite: " + json.state);
					} else {
						logger.log("Accept invite unsuccessful: " + json.reason);
						
						_InternalError(_call, _call.Error.NETWORK_FAILURE);
					}
				}
			};
		}
	};
	
	/**
	Create offer
	@private
	*/
	Call.prototype._doOffer = function() {
		// Create offer
		var mt= this; //needed for anonymous function
		if(this.isRTCConnection){	
		      this._pc.createOffer(function(sdp){
			    mt._sdp.sdp = sdp.sdp;
			    mt._sdp.type = "OFFER";
			    mt._pc.setLocalDescription(sdp);
			  }, 
			  function(err){ console.log("Err answer " + err);}, 
			  this.mediaType);
		}else{
			var offer = this._pc.createOffer(this.mediaType);
			this._pc.setLocalDescription(this._pc.SDP_OFFER, offer);
			
			// Start Ice
			this._pc.startIce();
			this._sdp.type = "OFFER";
			this._sdp.sdp = offer;
		}
	};

	/**
	Create offer
	@private
	*/
	Call.prototype._doMozOffer = function() {
		// Create offer
		var mt= this; //needed for anonymous function

		mt._pc.createOffer(
			// success
			function(offer) {
				console.log("_doMozOffer createOffer: " + offer.sdp);
				
				// Fix for Nightly_leif
				if (navigator.userAgent == "Nightly-Leif") {
					// substitute "RTP/SAVPF" into RTP/AVPF"
					var mod_sdp=offer.sdp.replace("RTP/SAVPF","RTP/AVP");
					console.log("FF-Nightly modified sdp:"+mod_sdp);
					offer.sdp = mod_sdp;
				}
				
				mt._sdp.sdp = offer.sdp;
			    mt._sdp.type = "OFFER";


			    console.log("before set localDescription");
				mt._pc.setLocalDescription(
					offer,
					// success
					function() {
						console.log("This offer is set as localDescription");
						console.log("send sdp offer");
						sendSdp(mt);
					},
					// failure
					function() {
						console.log("Failed to set this offer as localDescription!");
					},
					this.mediaType
				);
			},
			// fail
			function() {
				console.log("Failed to create local offer!");
			}
		);

	};	
	
	/**
	Create answer
	@private
	*/
	Call.prototype._doAnswer = function() {
	
		var mt= this; //needed for anonymous function
		console.log("_doAnswer " + this.mediaType);
		if(this.isRTCConnection){	
			try{
				var remoteSdp= {};
				remoteSdp.type= 'offer';
				remoteSdp.sdp= mt._sdp.sdp;
				
				mt._sdp.type= 'answer';
				mt._candidates.length= 0;
				
				var remoteDesc= new RTCSessionDescription(remoteSdp, null,function(err){ console.log("Err remoteSdp " + err);});
				mt._pc.setRemoteDescription(remoteDesc, 
					function(){ //success
						mt._pc.createAnswer(function(sdp){	
							if(mt._modID != null){							
								if(mt._sdp.sdp.indexOf("sendonly") != -1){
									var newsdp= _updateSdp(sdp.sdp, "sendrecv", "recvonly"); //audio
									newsdp= _updateSdp(newsdp, "sendrecv", "recvonly"); //video
									sdp.sdp= newsdp;
									mt.state= Call.State.WAITING;
								} else if(mt._sdp.sdp.indexOf("sendrecv") != -1){
									var newsdp= _updateSdp(sdp.sdp, "recvonly", "sendrecv"); //audio
									newsdp= _updateSdp(newsdp, "recvonly", "sendrecv"); //video
									sdp.sdp= newsdp;
									mt.state= Call.State.ONGOING;
								}
								mt._sendSignaling("ANSWER", sdp.sdp);
							}
							console.log("SDP answer= " + sdp.sdp);
							mt._pc.setLocalDescription(sdp);
							mt._sdp.sdp= sdp.sdp;							
						},
						function(err){ console.log("Err create answer " + err);}, 
						mt.mediaType);
					},
					function(err){ console.log("Err setRemoteDescription " + err);});
				}catch(e){
					console.log(e);
				}
		} else {
			var sd = new SessionDescription(this._sdp.sdp);
			
			// Receive offer
			this._pc.setRemoteDescription(this._pc.SDP_OFFER, sd);
			
			// Create answer
			var answer = this._pc.createAnswer(this._pc.remoteDescription.toSdp(), this.mediaType);
			this._pc.setLocalDescription(this._pc.SDP_ANSWER, answer);
			
			// Start Ice
			this._pc.startIce();
			
			this._sdp.type = "ANSWER";
			this._sdp.sdp = answer;
			
			// Process Ice candidates
			for (index in this._candidates) {
				var candidate = new IceCandidate(this._candidates[index].label, this._candidates[index].candidate);
				this._pc.processIceMessage(candidate);
			}
		}
	};
	
	/**
	Create answer
	@private
	*/
	Call.prototype._doMozAnswer = function() {
	
		var mt= this; //needed for anonymous function
		console.log("_doMozAnswer " + this.mediaType);

		var remoteSdp= {};
		remoteSdp.type= 'offer';
		remoteSdp.sdp= mt._sdp.sdp;
				
		mt._sdp.type= 'answer';
		mt._candidates.length= 0;
		console.log("offer sdp " + remoteSdp.sdp);
				
		mt._pc.setRemoteDescription(remoteSdp, 
			function(){ // success
				mt._pc.createAnswer(function(sdp){	

					console.log("SDP answer= " + sdp.sdp);
					mt._sendSignaling("ANSWER", sdp.sdp);

					mt._pc.setLocalDescription(sdp,
						// success
							function() {
								console.log("succeed: answer setLocalDescription");
							},
							// failure
							function() {
								console.log("fail: answer setLocalDescription");
							}
					);
					mt._sdp.sdp= sdp.sdp;							
				},
				function(err){  // fail
					console.log("fail: create answer " + err);
				}, 
				mt.mediaType);
			},
			function(err){ console.log("Err setRemoteDescription " + err);}
		);
	};
		
	
	/**
	Called when the Call object changes its state.
	@event
	@type function
	@param evt An event describing the state change
	@param {String} evt.type "statechange"
	@param {Call.State} evt.newState The new state
	@param {Call.State} evt.oldState The old state
	@example
call.onstatechange = function(evt) {
	switch (evt.newState) {
		case Call.State.READY:
			// Call state has changed to READY
			break;
		case Call.State.ENDED:
			// Call state has changed to ENDED
			break;
		// ...
	}
};
	*/
	Call.prototype.onstatechange = function(evt){};
	
	/**
	Called when the call has begun, the call has started and media is now flowing.
	@event
	@type function
	@param evt
	@example
call.onbegin = function(evt) {
	// Call has begun
};
	*/
	Call.prototype.onbegin = function(evt){};
	
	/**
	Called when the call has ended. Media will no longer be flowing as the call was terminated.
	@event
	@type function
	@param evt
	@example
call.onend = function(evt) {
	// Call has ended
};
	*/
	Call.prototype.onend = function(evt){};
	
	/**
	Called when a remote stream is added.
	@event
	@type function
	@param evt An event containing the call object with localStreams and remoteStreams.
	@param {MediaStream} evt.stream The stream that was added.
	@param {Call} evt.call Call object containing the local and remote media streams list.
	@param {MediaStream[]} evt.call.localStreams Local media stream list.
	@param {MediaStream[]} evt.call.remoteStreams Remote media streams list.
	@example
var call = service.createCall(...);
call.onaddstream = function(evt) {
	if (evt.call.localStreams) {
		// Do stuff with the list of local media stream
	}
	if (evt.call.remoteStreams) {
		// Do stuff with the list of remote media stream
	}
};
	*/
	Call.prototype.onaddstream = function(evt){};
	Call.prototype.onaddlocalstream = function(evt){};
	
	/**
	Called when a remote stream is removed.
	@event
	@type function
	@param evt An event containing the call object with localStreams and remoteStreams.
	@param {MediaStream} evt.stream The stream that was removed.
	@param {MediaStream[]} evt.call.localStreams Local media stream list
	@param {MediaStream[]} evt.call.remoteStreams Remote media streams list
	@example
call.onremovestream = function(evt) {
	if (evt.call.localStreams) {
		// Perform actions with the list of local media stream.
	}
	if (evt.call.remoteStreams) {
		// Perform actions with the list of remote media stream.
	}
};
	*/
	Call.prototype.onremovestream = function(evt){};
	
	/**
	Called when the call has encountered an error. The call has encountered an unexpected behavior.
	@event
	@type function
	@param evt Error event
	@param {String} evt.type "error"
	@param {Call.Error} evt.reason Error code
	@param {Object} evt.target Proximal event target
	@example
call.onerror = function(evt) {
	switch (evt.reason) {
		case Call.Error.NETWORK_FAILURE:
			// Handle
			break;
		case Call.Error.PEER_CONNECTION:
			// Handle
			break;
		// ...
	}
};
	*/
	Call.prototype.onerror = function(evt){};
	
	/**
	The OutgoingCall objects can be used to initiate calling.
	@class <p>OutgoingCall objects are created by {@link MediaServices#createCall} and are used to initiate calls to other parties.</p>
	@extends Call
	@param {MediaServices} mediaServices Object that created this Call object.
	@param {String} recipient Call recipient
	@param {String} mediaType Media types supported in this call (i.e. "audio", "video" or "audio,video")
	*/
	OutgoingCall = function(mediaServices, recipient, mediaType) {
		// call parent constructor
		Call.prototype.constructor.call(this, mediaServices, recipient, mediaType);
		
		this.state = Call.State.READY;
		
		logger.log("OutgoingCall created");
	};
	
	OutgoingCall.prototype = new Call;
	OutgoingCall.prototype.constructor = OutgoingCall;
	
	/**
	Initiates the outgoing call, ringing the recipient.
	@function
	@return void
	@example
var call = ms.createCall("user2", "audio, video");
call.ring();
	*/
	OutgoingCall.prototype.ring = function() {
		var call = this;
		
		logger.log("OutgoingCall ringing...");

		if (navigator.mozGetUserMedia) {
  			console.log("This appears to be Firefox");
  			this.isMozillaConn=true;

			this._createMozPeerConnection(function() {
					call._doMozOffer();
				});
			
		} else if (navigator.webkitGetUserMedia) {
			console.log("This appears to be Chrome");
			
			try {
				this._createPeerConnection(function() {
					call._doOffer();
				});
			} catch (e) {
				this._DEPRECATEDcreatePeerConnection();
			}

		} else {
  			console.log("Browser does not appear to be WebRTC-capable");
		}	

		
		this.state = Call.State.RINGING;
	};
	
	/**
	The IncomingCall objects are provided by MediaService on an incoming call. This is a private constructor.
	@class <p>The IncomingCall objects are provided by mediaServices on an incoming call and are used to answer them.</p>
	@extends Call
	@param {MediaServices} mediaServices Object that created this Call object.
	@param {String} recipient An identifier denoting the recipient; this can be a WebID, a SIP URI, or a tel: URI.
	@param {String} mediaType Media types supported in this conference (i.e. "audio", "video" or "audio,video").
	*/
	IncomingCall = function(mediaServices, recipient, mediaType) {		
		// call parent constructor
		var call = Call.prototype.constructor.call(this, mediaServices, recipient, mediaType);
		call._isModerator= false;
		/**
		Remote SDP
		@deprecated Not used for JSEP. To remove when ROAP is no longer supported.
		@private
		*/
		this._DEPRECATEDsdp = null;
		
		this.state = Call.State.READY;
		
		logger.log("IncomingCall created");
	};
	
	IncomingCall.prototype = new Call;
	IncomingCall.prototype.constructor = IncomingCall;
	
	/**
	Acknowledges an incoming call and establishes media. Note that if the mediaType of this call is to be changed, it must be changed before a call to answer().
	@function
	@return void
	@example
service.oninvite = function(evt) {
	if (evt.call) {
		evt.call.answer();
	}
};
	*/
	IncomingCall.prototype.answer = function() {
		var call = this;
		logger.log("IncomingCall ringing...");

		if (navigator.mozGetUserMedia) {
  			console.log("This appears to be Firefox");
  			this.isMozillaConn=true;

			try {
					this._createMozPeerConnection(function() {
						call._doMozAnswer();
					});
			} catch (e) {
				console.log("exception in _doMozAnswer"+e.message);
			}

		} else if (navigator.webkitGetUserMedia) {
			console.log("This appears to be Chrome");
			
			try {
				this._createPeerConnection(function() {
					call._doAnswer();
				});
			} catch (e) {
				var roapMessage = this._DEPRECATEDroap.processRoapOffer(this._mediaServices, this._DEPRECATEDsdp);
				
				this._DEPRECATEDcreatePeerConnection(null, roapMessage);
			}

		} else {
  			console.log("Browser does not appear to be WebRTC-capable");
		}
	};
	
	// Internal constructor.
	/**
	The Conference object allows interaction with a conference. It includes joining, leaving, ending, and moderating the conference (adding/removing participants).
	A conference object can only be created with {@link MediaServices#createConference} or {@link MediaServices}.oninvite.
	<p>
	The Conference object can be treated as a Call for the purposes of media control. It will elicit the same events for the purposes of a client joining the conference.
	Even if a client has access to a Conference object, it does not imply this client is a participant of the conference. Indeed the client can
	still use the other Conference methods like the moderator functions. Therefore a client can be the moderator of a conference in which he is not participating.</p>
	<p>This is a private constructor.</p>
	@class <p>The Conference object allows interaction with a conference, including joining, leaving, ending, and moderating the conference (adding/removing participants).
	A conference object can only be created with {@link MediaServices#createConference} or {@link MediaServices}.oninvite.
	<p>The Conference object can be treated as a Call for the purposes of media control. It will elicit the same events for the purposes of a client joining the conference.
	Even if a client has access to a Conference object, it does not imply this client is a participant of the conference. Indeed the client can
	still use the other Conference methods like the moderator functions. Therefore a client can be the moderator of a conference in which he is not participating.</p>
	@extends Call
	@property {Conference.State} confState The current state of the conference itself (read only).
	@property {String} confID The ID of this conference.
	@param {MediaServices} mediaServices The object that created this Conference object.
	@param {String} confId the ID of this conference.
	@param {String} url The URL to the MediaGateway.
	@param {String} mediaType The media types supported in this conference (e.g. "audio", "video" or "audio,video").
	@protected
	*/
	Conference = function(mediaServices, confId, url, mediaType) {
		Object.defineProperty(this, "confID", {
			get: function() {return confId;},
			set: function(newType) {confId = newType;}
		});
	
		Call.prototype.constructor.call(this, mediaServices, confId, mediaType);
		
		// Change the URL of the object. This will make the Call methods use the Conference URL for their method calls (signaling, etc)
		this._url = url;
		this.state = Conference.State.NEW;
		
		logger.log("Conference created");
	};
	
	/**
	@namespace Describes the possible states of the conference object. 
	*/
	Conference.State = {};
	
	/**
	This is a new Conference object and it has not yet been started; the begin() method should be called to begin this new conference.
	*/
	Conference.State.NEW = 0;
	
	/**
	The Conference object is in progress and users may join; the conference is ongoing.
	*/
	Conference.State.IN_PROGRESS = 2;
	
	/**
	The Conference object has ended; the conference was terminated in an expected and controlled manner.
	*/
	Conference.State.ENDED = 3;
		
	/**
	The Conference object has ended unexpectedly with an error; the conference was terminated in an unexpected manner (see {@link Conference.Error} for more details).
	*/
	Conference.State.ERROR = 4;
	
	/**
	@namespace Describes the possible errors of the conference object.
	*/
	Conference.Error = {};
	
	/**
	General network failure.
	*/
	Conference.Error.NETWORK_FAILURE = 0;
	
	/**
	Peer Connection setup failure
	*/
	Conference.Error.PEER_CONNECTION = 1;
	
	// Import all methods from Call
	Conference.prototype = new Call;
	Conference.prototype.constructor = Conference;
	
	Conference.prototype.isConference = function() { return true;};
	/**
	Leaves the conference.
	@function
	@return void
	@throws {Error} No active conference to leave
	@example
conf.leave();
	*/
	Conference.prototype.leave = function() {
		var _conf = this;
		var conferenceURL = this._url;
		
		logger.log("Leaving conference: " + this.confID + "...");
				
		// Create and send a leave conference request
		var req = new _CreateXmlHttpReq();
		
		req.open("DELETE", conferenceURL, true);
		req.setRequestHeader("X-http-method-override", "DELETE");
		req.send(null);
	
		// On response
		req.onreadystatechange = function() {
			if (req.readyState == 4) {
				
				// Success response 202
				if (req.status == 204) {
					logger.log("End conference successful!");
					
					_conf.state = Conference.State.ENDED;
					if (typeof(_conf.onend) == "function") { 
						_conf.onend({reason: "Conference terminated"}); 
					}
				} else {
					var json = JSON.parse(req.responseText);
					logger.log("End conference unsuccessful: " + json.reason);
					
					if (req.status == 403) {
						throw new Error("No active conference to leave");
					} else {
						_InternalError(_conf, Conference.Error.NETWORK_FAILURE);
					}
				}
			}
		};
		
		if (this._pc && this._pc.close)
			this._pc.close();
		this._pc = null;
	};
	
	/**
	Joins the conference. Join a conference by establishing media according to the previous parameters.
	@function
	@return void
	@throws {Error} Invalid conference ID.
	@example
var conf = createConference(..., "confID");
conf.join(); // Joins conference with confID
	*/
	Conference.prototype.join = function() {
		var conf = this;
		
		logger.log("Joining conference: " + this.confID + "...");
		
		if (this.confID == "" || typeof(this.confID) != "string") {
			throw new Error("Invalid conference ID");
		}
		
		this.recipient = "conf:" + this.confID;
		
		try {
			this._createPeerConnection(function() {
				conf._doAnswer();
			});
		} catch (e) {
			this._DEPRECATEDcreatePeerConnection();
		}
	};
	
	/**
	Ends the conference. All participants are removed and new ones are unallowed to join. The caller must be authorized to moderate the conference to do so.
	@function
	@return void
	@example
conf.end();
	*/
	Conference.prototype.end = function() {
		// TODO: remove all users from the conference before leaving		
		this.leave();
	};
	
	/**
	Forcibly removes a user from the conference.
	@function
	@param {String} user Specifies the name, SIP or tel URI of the user to be removed from the conference.
	@param {function} [callback] A callback function, with signature <i>callback(evt)</i> to indicate whether the user was removed or not.
	@return void
	@throws {TypeError} Invalid user
	@example
conf.removeUser("test2", function(evt) {
	if (evt.success) {
		// User has been removed successfully
	} else if (evt.failure) {
		// Removing user has failed due to evt.reason
	}
});
	*/
	Conference.prototype.removeUser = function(user, callback) {
		var conferenceURL = this._url + '/' + CONFERENCE_RESOURCE_REMOVE;
		
		logger.log("Removing participant " + user + " from conference " + this.confID + "...");
		
		if (typeof(user) != "string") {
			throw new TypeError("Invalid user");
		} else {
			var body = {
				members : [user]
			};
			
			// Create and send a remove user request
			var req = new _CreateXmlHttpReq();
			
			req.open("POST", conferenceURL, true);
			req.setRequestHeader("Content-Type", "application/json");
			req.setRequestHeader("Accept", "application/json, text/html");
			req.send(JSON.stringify(body, null, " "));
		
			// On response
			req.onreadystatechange = function() {
				if (req.readyState == 4) {
					
					// Success response 202
					if (req.status == 202) {
						logger.log("Remove participant successful!");
						
						if (typeof(callback) == "function") {
							var event = {success : true, failure: false};
							callback(event);
						}
					} else {
						var reason= "unknown, status= " + req.status;
						if(req.responseText != ""){ //TODO EVERYWHERE check the response before parsing json
							reason = JSON.parse(req.responseText).reason;
						}
						
						logger.log("Remove participant unsuccessful: " + reason);
						
						if (typeof(callback) == "function") {
							var event = {success : false, failure: true};
							callback(event);
						}
					}
				}
			};
		}
	};
	
	/**
	Adds a user to the conference.
	@function
	@param {String} user Defines the name, SIP or tel URI of the user to be added to the conference.
	@param {function} [callback] A callback function, with signature <i>callback(evt)</i> to indicate whether the user was added or not.
	@return void
	@throws {Error} Invalid user
	@example
conf.addUser("test2", function(evt) {
	if (evt.success) {
		// User has been added successfully
	} else if (evt.failure) {
		// Adding user has failed due to evt.reason
	}
});
	*/
	Conference.prototype.addUser = function(user, callback) {
		var conferenceURL = this._url + '/' + CONFERENCE_RESOURCE_ADD;
		
		logger.log("Adding participant " + user + " to conference " + this.confID + "...");
		
		if (typeof(user) != "string" || user == "") {
			throw new Error("Invalid user");
		} else {
			var body = {
				members : [user]
			};
			
			// Create and send an add participant request
			var req = new _CreateXmlHttpReq();
			
			req.open("POST", conferenceURL, true);
			req.setRequestHeader("Content-Type", "application/json");
			req.setRequestHeader("Accept", "application/json, text/html");
			req.send(JSON.stringify(body, null, " "));
		
			// On response
			req.onreadystatechange = function() {
				if (req.readyState == 4) {
					// Success response 202
					if (req.status == 202) {
						logger.log("Add participant successful");
						
						if (typeof(callback) == "function") {
							var event = {success : true, failure: false};
							callback(event);
						}
					} else {
						var reason= "unknown, status= " + req.status;
						if(req.responseText != ""){ //TODO EVERYWHERE check the response before parsing json
							reason = JSON.parse(req.responseText).reason;
						}
						
						logger.log("Add participant unsuccessful: " + reason);
						if (typeof(callback) == "function") {
							var event = {success : false, failure: true};
							callback(event);
						}
					}
				}
			};
		}
	};
	
	/**
	Begins the conference. The moderator automatically joins the conference on success.
	@function
	@param {function} [callback] A callback function, with signature <i>callback(evt)</i> to indicate whether the conference has successfully started or not.
	@return void
	@example
var conf = service.createConference(...);
conf.begin(function(evt) {
	if (evt.success == true) {
		// Conference has started successfully
	} else if (evt.failure == true) {
		// Conference has failed due to evt.reason
	}
)};
	*/
	Conference.prototype.begin = function(callback) {
		logger.log("Conference beginning...");
		var conf = this;
		
		try {
			this._createPeerConnection(function() {
				conf._doOffer();
			});
		} catch (e) {
			this._DEPRECATEDcreatePeerConnection(function(status) {
				if (typeof(callback) == "function") {
					callback(status);
				}
			});
		}
	};
	
	/**
	File Transfer contains information associated to the current file transfer session. This is a private constructor.
	@class <p>File Transfer contains information associated to the current file transfer session. A file transfer session can be initiated by 
	calling {@link MediaServices#createFileTransfer} and then {@link OutgoingFileTransfer#sendFile} which sends a file transfer request to the destination. </p>
	<p>Upon the recipient accepting, the file will be uploaded on the sending side and downloaded on the receiving side automatically.</p>
	@property {FileTransfer.state} state The file transfer's current state (read only).
	@property {String} name File name (read only).
	@property {String} size File size in bytes (read only).
	@property {String} type File type (read only).
	@param {MediaServices} mediaServices The object that created this File Transfer object.
	*/
	FileTransfer = function(mediaServices) {
		var _state = FileTransfer.State.IDLE;
		
		this._url = null;
		this._mediaServices = mediaServices;
		this._fileName = null;
		this._fileSize = null;
		this._fileType = null;
		this._id = null;
		
		/**
		@field state
		*/
		Object.defineProperty(this, "state", {
			get: function()
			{
				return _state;
			},
			set: function(newState)
			{
				_state = newState;
				
				if (typeof(this.onstatechange) == "function") {
					var evt = {type: "statechange", oldState : _state, state: newState};
					this.onstatechange(evt);
				}
					
				switch (newState) {
					case FileTransfer.State.INVITATION_RECEIVED:
						var evt = { call: null, conf: null, ftp: this };
						if (typeof(mediaServices.oninvite) == "function") { mediaServices.oninvite(evt); }
						break;
					case FileTransfer.State.DOWNLOAD_COMPLETE:
						var evt = { ftp: this };
						if (typeof(this.onreceivedfile) == "function") { this.onreceivedfile(evt); }
					default:
						break;
				}
			}
		});
		
		/**
		@field name
		*/
		Object.defineProperty(this, "name", {
			get: function() { return this._fileName; }
		});
		
		/**
		@field size
		*/
		Object.defineProperty(this, "size", {
			get: function() { return this._fileSize; }
		});
		
		/**
		@field type
		*/
		Object.defineProperty(this, "type", {
			get: function() { return this._fileType; }
		});
	};
	
	/**
	Cancels an active file transfer or rejects a file transfer invitation.
	@function
	@return void
	@throws {Error} No active file transfer session
	@example
ftp.cancel();
	*/
	FileTransfer.prototype.cancel = function() {
		var url = this._url + '/' + FILETRANSFER_RESOURCE_TERMINATE + '/' + this._id;
		var ft = this;
		
		if (!this._id || this.state == FileTransfer.State.UPLOAD_COMPLETE ||
			this.state == FileTransfer.State.DOWNLOAD_COMPLETE) {
			throw new Error("No active file transfer session");
		}
		
		logger.log("Terminating file transfer...");
		
		// Create and send a cancel file transfer request
		var req = new _CreateXmlHttpReq();
		
		req.open("GET", url, true);
		req.setRequestHeader("Accept", "application/json, text/html");
		req.send(null);
	
		// On response
		req.onreadystatechange = function() {
			if (req.readyState == 4) {
				// Success response 204 No Content
				if (req.status == 204) {
					logger.log("File transfer terminated");
				} else {
					var json = JSON.parse(req.responseText);
					logger.log("File transfer termination failed: " + json.reason);
					
					_InternalError(ft, FileTransfer.Error.NETWORK_FAILURE);
				}
			}
		};
	};
	
	// Callback functions for MediaServices
	/**
	Called when FileTransfer changes its state.
	@event
	@type function
	@param evt Event describing the state change
	@param {FileTransfer.State} evt.newState New state
	@param {FileTransfer.State} evt.oldState Old state
	@example
ftp.onstatechange = function(evt) {
	switch (evt.newState) {
		case FileTransfer.State.INVITATION_SENT:
			// FileTransfer state has changed to INVITATION_SENT
			break;
		case FileTransfer.State.UPLOADING:
			// FileTransfer state has changed to UPLOADING
			break;
		// ...
	}
};
	*/
	FileTransfer.prototype.onstatechange = function(evt) {};
	
	/**
	Called when FileTransfer has encountered an error.
	@event
	@type function
	@param evt Error event
	@param {String} evt.type "error"
	@param {Call.Error} evt.reason Error code
	@param {Object} evt.target Proximal event target
	@example
ftp.onerror = function(evt) {
	switch (evt.reason) {
		case FileTransfer.Error.NETWORK_FAILURE:
			// Handle
			break;
		// ...
	}
};
	*/
	FileTransfer.prototype.onerror = function(evt) {};
	
	/**
	@namespace Describes the possible states of the FileTransfer object.
	*/
	FileTransfer.State = {};
	
	/**
	FileTransfer is idle and ready to be used.
	*/
	FileTransfer.State.IDLE = 0;
	
	/**
	A file transfer invitation has been sent.
	*/
	FileTransfer.State.INVITATION_SENT = 1;
	
	/**
	A file transfer invitation has been received
	*/
	FileTransfer.State.INVITATION_RECEIVED = 2;
	
	/**
	A file is currently being uploaded to the server.
	*/
	FileTransfer.State.UPLOADING = 3;
	
	/**
	A file is currently being downloaded from the server.
	*/
	FileTransfer.State.DOWNLOADING = 4;
	
	/**
	A file transfer upload has completed successfully.
	*/
	FileTransfer.State.UPLOAD_COMPLETE = 5;
	
	/**
	A file transfer download has completed successfully.
	*/
	FileTransfer.State.DOWNLOAD_COMPLETE = 6;
	
	/**
	A file transfer has been canceled or rejected.
	*/
	FileTransfer.State.CANCELED = 7;
	
	/**
	The file transfer has encountered an error. See {@link FileTransfer.Error} for more details
	*/
	FileTransfer.State.ERROR = 8;
	
	/**
	@namespace Describes the possible errors of the FileTransfer object.
	*/
	FileTransfer.Error = {};
	
	/**
	General network failure.
	*/
	FileTransfer.Error.NETWORK_FAILURE = 0;
	
	/**
	File size is larger than the limit
	*/
	FileTransfer.Error.FILE_SIZE_LIMIT = 1;
	
	/**
	The user cannot be found
	*/
	FileTransfer.Error.INVALID_USER = 2;
	
	/**
	The file transfer timed out
	*/
	FileTransfer.Error.TIMEOUT = 3;
	
	/**
	The OutgoingFileTransfer objects can be used to initiate a file transfer.
	@class <p>OutgoingFileTransfer objects are created by {@link MediaServices#createFileTransfer} and are used to initiate file transfer requests to other parties.</p>
	@extends FileTransfer
	@param {MediaServices} mediaServices Object that created this FileTransfer object.
	@param {String} destination File transfer destination (recipient).
	@property {String} to Outgoing file transfer recipient (read only).
	@property {File} file Reference to the current file being transfered (read only).
	*/
	OutgoingFileTransfer = function(mediaServices, destination) {
		FileTransfer.prototype.constructor.call(this, mediaServices);
		
		var _destination = destination;
		this._file = null;
		
		/**
		@field to
		Upload destination
		*/
		Object.defineProperty(this, "to", {
			get: function() { return _destination; }
		});
		
		/**
		@field file
		*/
		Object.defineProperty(this, "file", {
			get: function() { return this._file; }
		});
	};
	
	/**
	Called when a file upload is in progress.
	@event
	@type function
	@param evt
	@param {Number} evt.loaded The amount of bytes uploaded.
	@param {Number} evt.total The total amount of bytes to be uploaded.
	@example
ftp.onuploadprogress = function(evt) {
	console.log(event.loaded / event.total * 100 + "%");
};
	*/
	OutgoingFileTransfer.prototype.onuploadprogress = function(evt) {};
	
	OutgoingFileTransfer.prototype = new FileTransfer;
	OutgoingFileTransfer.prototype.constructor = OutgoingCall;
	
	/**
	Sends a file transfer request to the destination. The file will be automatically uploaded on acceptance.
	@function
	@return void
	@param {File} file A reference to the file being sent.
	@throws {TypeError} Invalid file
	@example
var file = document.getElementById("file");
ftp.sendFile(file.files[0]);
	*/
	OutgoingFileTransfer.prototype.sendFile = function(file) {
		if (!(file instanceof File)) {
			throw new TypeError("Invalid file");
		}
		
		var ft = this;
		this._file = file;
		this._fileType = file.type;
		this._fileName = file.name;
		this._fileSize = file.size;
		
		var url = this._url + '/' + FILETRANSFER_RESOURCE_SEND;
		
		logger.log("Initiating file transfer...");
		
		var body = {
			to : this.to,
			contentDisposition : "attachment",
			contentType : this.type,
			fileName : this.name,
			fileSize : this.size
		};
		
		// Create and send a file transfer request
		var req = new _CreateXmlHttpReq();
		
		req.open("POST", url, true);
		req.setRequestHeader("Accept", "application/json, text/html");
		req.setRequestHeader("Content-Type", "application/json");
		req.send(JSON.stringify(body, null, " "));
	
		// On response
		req.onreadystatechange = function() {
			if (req.readyState == 4) {
				var json = JSON.parse(req.responseText);
				// Success response 202 Accepted
				if (req.status == 202) {
					logger.log("File invitation sent, ID: " + json.ftId + ", state: " + json.state);
					
					ft.state = FileTransfer.State.INVITATION_SENT;
					
					// Put it in the hashmap
					ft._mediaServices._ftp.put(json.ftId, ft);
				} else {
					logger.log("File invitation failed: " + json.reason);
					
					_InternalError(ft, FileTransfer.Error.NETWORK_FAILURE);
				}
			}
		};
	};
	
	/**
	WCG REST request for uploading a file. Upload occurs automatically upon acceptance.
	@function
	@return void
	@private
	*/
	OutgoingFileTransfer.prototype._uploadFile = function() {
		var url = this._url + '/' + FILETRANSFER_RESOURCE_UPLOAD + '/' + this._id;
		var ft = this;
		
		ft.state = FileTransfer.State.UPLOADING;
			
		logger.log("Uploading file...");
		
		// The body is a multipart/form-data payload
		var body = new FormData(); // Chrome 7+, Firefox 4+, Internet Explorer 10+, Safari 5+
		body.append("Filename", this._fileName);
		body.append("ClientId", this._mediaServices._sessionID);
		body.append("Filedata", this._file);
		body.append("Upload", "Submit Query");
		
		// Create and send a file upload request
		var req = new _CreateXmlHttpReq();
		
		req.upload.addEventListener("progress", function(evt) {
			var event = { "loaded": evt.loaded, "total": evt.total };
			ft.onuploadprogress(event);
		}, false);
		req.open("POST", url, true);
		req.setRequestHeader("Accept", "application/json, text/html");
		req.send(body);
	
		// On response
		req.onreadystatechange = function() {
			if (req.readyState == 4) {
				// Success response 204 No Content
				if (req.status == 204) {
					logger.log("File uploaded");
					
					if (ft.state != FileTransfer.State.CANCELED) {
						ft.state = FileTransfer.State.UPLOAD_COMPLETE;
					}
				} else {
					var json = JSON.parse(req.responseText);
					logger.log("File upload failed: " + json.reason);
					
					if (ft.state != FileTransfer.State.CANCELED &&
						ft.state != FileTransfer.State.ERROR) {
						ft.state = FileTransfer.State.CANCELED;
					}
				}
			}
		};
	};
	
	/**
	The IncomingFileTransfer objects are provided by MediaService on an incoming file transfer request. This is a private constructor.
	@class <p>The IncomingFileTransfer objects are provided by MediaService on an incoming file transfer request.</p>
	@extends FileTransfer
	@param {MediaServices} mediaServices Object that created this FileTransfer object.
	@param {String} from Initiator of file transfer.
	@property {String} rawData Raw data received (read only).
	@property {String} data Base 64 encoded data uri of the file (read only).
	@property {String} from Initiator of file transfer (read only).
	*/
	IncomingFileTransfer = function(mediaServices, from) {
		FileTransfer.prototype.constructor.call(this, mediaServices);
		
		this._from = from;
		this._rawData = null;
		this._data = null;
		
		/**
		@field Raw data received.
		*/
		Object.defineProperty(this, "rawData", {
			get: function() { return this._rawData; }
		});
		
		/**
		@field Base 64 encoded data received.
		*/
		Object.defineProperty(this, "data", {
			get: function() { return this._data; }
		});
		
		/**
		@field File transfer initiator
		*/
		Object.defineProperty(this, "from", {
			get: function() { return this._from; }
		});
		
	};
	
	/**
	Called when a file download is in progress.
	@event
	@type function
	@param evt
	@param {Number} evt.loaded The amount of bytes downloaded.
	@param {Number} evt.total The total amount of bytes to download.
	@example
ftp.ondownloadprogress = function(evt) {
	console.log(event.loaded / event.total * 100 + "%");
};
	*/
	IncomingFileTransfer.prototype.ondownloadprogress = function(evt) {};
	
	/**
	Called when the file transfer has finished (when the file has been fully downloaded).
	@event
	@type function
	@param evt
	@param {IncomingFileTransfer} evt.ftp The IncomingFileTransfer object.
	@param {String} evt.ftp.rawData Raw bit stream of the file.
	@param {String} evt.ftp.data Data URI of the file in base 64.
	@example
call.onreceivedfile = function(evt) {
	// Do stuff with evt.ftp.data
};
	*/
	IncomingFileTransfer.prototype.onreceivedfile = function(evt) {};
	
	IncomingFileTransfer.prototype = new FileTransfer;
	IncomingFileTransfer.prototype.constructor = IncomingFileTransfer;
	
	/**
	Accept an incoming file transfer invitation. The file will be automatically downloaded afterwards.
	@function
	@return void
	@throws {Error} No active file transfer session
	@example
ms.oninvite = function(evt) {
	if (evt.ftp) {
		evt.ftp.accept();
	}
};
	*/
	IncomingFileTransfer.prototype.accept = function() {
		if (this.state == FileTransfer.State.UPLOAD_COMPLETE ||
				this.state == FileTransfer.State.DOWNLOAD_COMPLETE) {
			throw new Error("No active file transfer session");
		}
		
		var url = this._url + '/' + FILETRANSFER_RESOURCE_ACCEPT + '/' + this._id;
		var ft = this;
		
		logger.log("IncomingFileTransfer accepting...");
		
		// Create and send an accept file transfer request
		var req = new _CreateXmlHttpReq();
		
		req.open("GET", url, true);
		req.setRequestHeader("Accept", "application/json, text/html");
		req.send(null);
	
		// On response
		req.onreadystatechange = function() {
			if (req.readyState == 4) {
				// Success response 201 Created
				if (req.status == 200) {
					logger.log("IncomingFileTransfer accepted");
				} else {
					var json = JSON.parse(req.responseText);
					logger.log("IncomingFileTransfer accept failed: " + json.reason);
					
					_InternalError(ft, FileTransfer.Error.NETWORK_FAILURE);
				}
			}
		};
	};
	
	/**
	WCG REST request for downloading a file. Download occurs automatically when ready.
	@function
	@return void
	@private
	*/
	IncomingFileTransfer.prototype._downloadFile = function() {
		var url = this._url + '/' + FILETRANSFER_RESOURCE_GETFILE + '/' + this._id;
		var ft = this;
		var loaded = null;
		
		ft.state = FileTransfer.State.DOWNLOADING;
		
		logger.log("Downloading file...");
		
		// Create and send a download file transfer request
		var req = new _CreateXmlHttpReq();
		
		req.addEventListener("progress", function(evt) {
			var event = { "loaded": evt.loaded, "total": ft.size };
			loaded = evt.loaded;
			ft.ondownloadprogress(event);
		}, false);
		req.open("GET", url, true);
		req.overrideMimeType("text/plain; charset=x-user-defined");
		req.send(null);
	
		// On response
		req.onreadystatechange = function() {
			if (req.readyState == 4) {
				// Success response 200 OK
				if (req.status == 200) {
					if (ft.state != FileTransfer.State.CANCELED && ft.state != FileTransfer.State.ERROR) {
						// We have a response and we are in a non-failure state
						if (req.responseText && loaded == ft.size) {
							// req.responseText is a binary stream of the file received
							ft._rawData = req.responseText;
							ft._data = 'data:' + ft.type + ';base64,' + _Base64encode(req.responseText);
							
							ft.state = FileTransfer.State.DOWNLOAD_COMPLETE;
						} else {
							if (ft.state != FileTransfer.State.CANCELED &&
									ft.state != FileTransfer.State.ERROR) {
								ft.state = FileTransfer.State.CANCELED;
							}
						}
					}
				} else {
					var json = JSON.parse(req.responseText);
					logger.log("Downloading file failed: " + json.reason);
					
					_InternalError(ft, FileTransfer.Error.NETWORK_FAILURE);
				}
			}
		};
	};
	
	/**
	Chat is a generic handler for a one-to-one chat. Chat allows the user to send and receive chat messages, 
	media messages (50 kB images), is-composing (typing) events. A Chat object can only be created by {@link MediaServices#createChat}. 
	This is a private constructor.
	@class Chat is a generic handler for a one-to-one chat. Chat allows the user to send and receive chat messages, 
	media messages (50 kB images), is-composing (typing) events. A Chat object can only be created by {@link MediaServices#createChat}. 
	This is a private constructor. <br />
	@property {Chat.State} state The chat session's current state (readonly).
	@property {String} recipient The recipient of this chat session (readonly).
	@param {MediaServices} mediaServices The parent MediaServices instance.
	@param {String} recipient The chat message recipient.
	*/
	Chat = function(mediaServices, recipient) {
		var _state = Chat.State.NEW;
		this._mediaServices = mediaServices;
		
		/**
		@field state
		The state of the call
		*/
		Object.defineProperty(this, "state", {
			get: function()
			{
				return _state;
			},
			
			set: function(newState)
			{
				_state = newState;
				
				if (typeof(this.onstatechange) == "function") {
					var evt = {type: "statechange", oldState : _state, state: newState};
					this.onstatechange(evt);
				}
					
				if ((newState == Chat.State.ACTIVE || newState == GroupChat.State.IN_PROGRESS) && typeof(this.onbegin) == "function")
					this.onbegin(evt);
				if (newState == GroupChat.State.ENDED && typeof(this.onend) == "function")
					this.onend(evt);
			}
		});
		
		/**
		@field recipient
		The recipient of the chat session
		*/
		Object.defineProperty(this, "recipient", {
			get: function() { return this._recipient; }
		});
		
		/**
		Chat message recipient
		@private
		*/
		this._recipient = recipient;
		
		/**
		Lock used to determine if the user can send an is-composing request, or has to wait
		@private
		*/
		this._composingWait = false;
		
		/**
		The base URL including session ID ("baseURL"/"sessionID"/)
		@private
		*/
		this._url = null;
	};
	
	/**
	@namespace Describes the states of the chat object.
	*/
	Chat.State = {};
	
	/**
	A new Chat object has been initialised
	*/
	Chat.State.NEW = 0;
	
	/**
	A chat session is considered active when the chat initiator has sent at least 1 message to the recipient.
	Typing/idle is-composing events and media messages can only be sent in this state.
	*/
	Chat.State.ACTIVE = 1;
	
	/**
	The Chat object has encountered an error
	*/
	Chat.State.ERROR = 3;
	
	/**
	@namespace Describes the possible errors of the Chat object.
	*/
	Chat.Error = {};
	
	/**
	General network failure
	*/
	Chat.Error.NETWORK_FAILURE = 0;
	
	/**
	The recipient is an invalid user
	*/
	Chat.Error.INVALID_USER = 1;
	
	/**
	The recipient is offline and is unable to receive chat messages
	*/
	Chat.Error.USER_NOT_ONLINE = 2;
	
	/**
	Sends a chat message to the recipient. This function can be called at any time once a Chat object has been created.
	@function
	@return void
	@param {String} body The message to be sent.
	@throws {Error} No body
	@example
var chat = service.createChat("sip:491728885004@mns.ericsson.ca");
chat.send("Hello world!");
	*/
	Chat.prototype.send = function(body) {
		var chat = this;
		
		if(!body || typeof(body) != "string"){
			throw new Error("No body");
		}
		
		logger.log("Sending message...");
		
		var messageURL = this._url + '/' + CHAT_RESOURCE_SEND;
		
		// Clear the composing wait lock
		chat._composingWait = false;
		
		// Create and send a create conference request
		var req = new _CreateXmlHttpReq();
		
		var message = null;
		if (this instanceof GroupChat) {
			message = {
				confId : this.confID,
				body : body
			};
		} else {
			message = {
				to : this.recipient,
				body : body,
				contentType : "text/plain",
				type : "session-message"
			};
		}
			
		req.open("POST", messageURL, true);
		req.setRequestHeader("Accept", "application/json, text/html");
		req.setRequestHeader("Content-Type", "application/json");
		req.send(JSON.stringify(message, null, " "));
	
		// On response
		req.onreadystatechange = function() {
			if (req.readyState == 4) {			
				var json= "\"\"";
				if(req.responseText != "") {
					json= JSON.parse(req.responseText);
				}
				// Success response 200 OK for Chat
				if (req.status == 200) {
					logger.log("Send message successful: msgId " + json.msgId);
					
					// Put the current Chat/GroupChat object in the HashMap
					if (chat.recipient) {
						if (!chat._mediaServices._chat.get(chat.recipient)) {
							chat._mediaServices._chat.put(chat.recipient, chat);
						}
					}
				}
				// Success response 202 Accepted for GroupChat
				else if (req.status == 202) {
					logger.log("Send message successful: msgId " + json.msgId);
				} else {
					if (req.status == 400) {
						_InternalError(chat, Chat.Error.INVALID_USER);
					} else {
						_InternalError(chat, Chat.Error.NETWORK_FAILURE);
					}
				}
			}
		};
		
	};
	
	/**
	Sends a typing is-composing notification to the other user(s)
	@function
	@return void
	@throws {Error} Unable to send composing event until the chat session is active
	@example
object.onkeypress = function() {
	chat.typing();
};
	*/
	Chat.prototype.typing = function() {
		// Don't send an is composing event if another one has been sent recently
		if (!this._composingWait && (this.state == Chat.State.ACTIVE || this.state == GroupChat.State.IN_PROGRESS)) {
			this._composingWait = true;
			this._sendComposing("active", 10);
		}
	};
	
	/**
	Sends an idle is-composing notification to the other user(s)
	@function
	@return void
	@throws {Error} Unable to send composing event until the chat session is active
	@example
chat.idle();
	*/
	Chat.prototype.idle = function() {
		// Send an idle if it was in the composing state
		if (this._composingWait && (this.state == Chat.State.ACTIVE || this.state == GroupChat.State.IN_PROGRESS)) {
			this._sendComposing("idle", 10);
			this._composingWait = false;
		}
	};
	
	/**
	Sends an is-composing event.
	@param {String} state "active" if typing, "idle" if not typing
	@param {Number} timer Refresh timer
	@throws {Error} Invalid state
	@private
	*/
	Chat.prototype._sendComposing = function(state, timer) {
		var chat = this;

		if (this.state != Chat.State.ACTIVE) {
			throw new Error("Unable to send composing event until the chat session is active");
		}
		if (state != "active" && state != "idle") {
			// Shouldn't happen
			throw new Error("Invalid state");
		}
		
		var messageURL = this._url + '/' + CHAT_RESOURCE_SEND_ISCOMPOSING;
		
		logger.log("Sending is-composing...");
		
		// Create and send a chat is composing request
		var req = new _CreateXmlHttpReq();
		
		var body = null;
		if (this instanceof GroupChat) {
			body = {
				confId : this.confID,
				state : state,
				refresh : timer
			};
		} else {
			body = {
				to : this.recipient,
				state : state,
				refresh : timer,
				contentType : "text/plain"
			};
		}			
			
		req.open("POST", messageURL, true);
		req.setRequestHeader("Accept", "application/json, text/html");
		req.setRequestHeader("Content-Type", "application/json");
		req.send(JSON.stringify(body, null, " "));
	
		// On response
		req.onreadystatechange = function() {
			if (req.readyState == 4) {
				// Success response 204 No content
				if (req.status == 204) {
					logger.log("Sending is-composing successful");
					
					// Timer to prevent user from sending another request until timer expires
					setTimeout(function() { chat._composingWait = false; }, timer * 1000);
				} else {
					logger.log("Sending is-composing unsuccessful");
					
					var json = JSON.parse(req.responseText);
					
					if (req.status == 403 && json.reason == "no active session") {
						throw new Error("No active chat session");
					} else {
						_InternalError(chat, Chat.Error.NETWORK_FAILURE);
					}
				}
			}
		};
	};
	
	
	/**
	Sends a media message to the recipient. The media file is restricted to image file types and a maximum size of 50 kB.
	This method can only be called when the Chat object is in the active state. Larger file transfers should be handled with {@link FileTransfer}.
	@function
	@return void
	@param {File} file A reference to the media image file being sent.
	@throws {TypeError} Invalid file type
	@throws {Error} Unable to send a media message until the chat session is active
	@throws {Error} Media size too large
	@throws {Error} No active chat session
	@example
chat.sendMedia(file.files[0]);
	*/
	Chat.prototype.sendMedia = function(file) {
		var _chat = this;

		if (!(file instanceof File)) {
			throw new TypeError("Invalid file type");
		}
		if (this.state != Chat.State.ACTIVE || this.state != GroupChat.State.IN_PROGRESS) {
			throw new Error("Unable to send a media message until the chat session is active");
		}
		if (file.type.indexOf("image") == -1) {
			// We only accept image file types
			throw new TypeError("Invalid file type");
		}
		if (file.size > MAX_MEDIA_SIZE) {
			throw new Error("Media size too large, maximum: " + MAX_MEDIA_SIZE + " current: " + file.size);
		}
		
		logger.log("Sending media message...");
		
		var url = "";
		if (this instanceof GroupChat) {
			url = this._url + '/' + GROUP_CHAT_RESOURCE_SEND_MEDIA + this.confID;
		} else {
			url = this._url + '/' + CHAT_RESOURCE_SEND_MEDIA + this.recipient;
		}
		
		// The body is a multipart/form-data payload
		var body = new FormData(); // Chrome 7+, Firefox 4+, Internet Explorer 10+, Safari 5+
		body.append("Filename", file.name);
		body.append("ClientId", this._mediaServices._sessionID);
		body.append("Filedata", file);
		body.append("Upload", "Submit Query");	
		
		// Create and send a create conference request
		var req = new _CreateXmlHttpReq();
		
		req.open("POST", url, true);
		req.setRequestHeader("Accept", "application/json, text/html");
		req.send(body);
	
		// On response
		req.onreadystatechange = function() {
			if (req.readyState == 4) {
				var json = JSON.parse(req.responseText);
				// Success response 200 OK
				if (req.status == 200) {
					// Chat
					logger.log("Send media message successful: msgId " + json.msgId);
				} else if (req.status == 202) {
					// Group chat
					logger.log("Send media message successful: msgId " + json.msgId);
				} else {
					logger.log("Send media message unsuccessful");

					if (req.status == 403) {
						// 403 Forbidden with reason: "no active session"
						throw new Error("No active chat session");
					} else if (req.status == 413) {
						// File size too big (shouldn't happen)
						throw new Error(json.reason);
					} else {
						_InternalError(_chat, Chat.Error.NETWORK_FAILURE);
					}
				}
			}
		};
	};
	
	/**
	Retrieve the media message. This is done automatically upon media message channel event.
	@private
	*/
	Chat.prototype._getMedia = function(id, from) {
		var _chat = this;
		var url = this._url + '/' + CHAT_RESOURCE_GET_MEDIA + id;
		
		logger.log("Getting media message...");
		
		// Create and send an add contact request
		var req = new _CreateXmlHttpReq();
		
		req.open("GET", url, true);
		req.overrideMimeType("text/plain; charset=x-user-defined");
		req.send(null);
	
		// On response
		req.onreadystatechange = function() {
			if (req.readyState == 4) {
				// Success response 200 OK
				if (req.status == 200) {
					logger.log("Get media message successful");
					
					var mediaType = req.getResponseHeader("Content-Type");
					var evt = {
						from : from,
						type : mediaType,
						media : 'data:' + mediaType + ';base64,' + _Base64encode(req.responseText),
						size : req.getResponseHeader("Content-Length")
					};
					
					chat.onmessage(evt);
				} else {
					var json = JSON.parse(req.responseText);
					logger.log("Get media message unsuccessful: " + json.reason);
					_InternalError(_chat, Chat.Error.NETWORK_FAILURE);
				}
			}
		};
	};
	
	/**
	Called when the Chat object changes its state.
	@event
	@type function
	@param evt An event describing the state change.
	@param {String} evt.type "statechange".
	@param {Chat.State} evt.newState New state.
	@param {Chat.State} evt.oldState Old state.
	@example
chat.onstatechange = function(evt) {
	switch (evt.newState) {
		case Chat.State.ACTIVE:
			// Chat state has changed to ACTIVE
			break;
		case Chat.State.ERROR:
			// Chat state has changed to ERROR
			break;
		// ...
	}
};
	*/
	Chat.prototype.onstatechange = function(evt) {};
	
	/**
	Called when the Chat object has begun and is in the active state. Sending and receiving of message/media/is-composing events can occur.
	@event
	@type function
	@param evt
	@example
chat.onbegin = function(evt) {
	// Chat has begun
};
	*/
	Chat.prototype.onbegin = function(evt) {};
	
	/**
	Called when a message is received in the event channel. The message can be either a chat message or media message.
	@event
	@type function
	@param evt An event containing a message or a media message
	@param {String} evt.from Composer of the message
	@param {String} [evt.message] Text message body
	@param {String} [evt.type] Media message type (jpeg, gif, png, etc)
	@param {String} [evt.media] Media message content (base 64 encoded data URI format)
	@param {String} [evt.size] Media message size in bytes
	@example
chat.onmessage = function(evt) {
	if (evt.message) {
		// Chat message
	} else if (evt.media) {
		// Media message
	}
};
	*/
	Chat.prototype.onmessage = function(evt) {};
	
	/**
	Called when a message has not been sent properly. TODO: Note that this is not implemented yet.
	@event
	@type function
	@param evt
	*/
	Chat.prototype.onmessagefailure = function(evt) {};
	
	/**
	Called when an is-composing message is received in the event channel
	@event
	@type function
	@param evt
	@param {String} evt.from Is-composing event originator
	@param {String} evt.state One of "active" (user is currently typing) or "idle" (user has stopped typing)
	@param {Number} evt.refresh The timer, in seconds, associated to this is-composing event. For example, an is-composing icon could be displayed for evt.refresh amount of time.
	@example
chat.oncomposing = function(evt) {
	if (evt.state == "active") {
		// User 'evt.from' is currently typing
	} else if (evt.state == "idle") {
		// User 'evt.from' has stopped typing
	}
};
	*/
	Chat.prototype.oncomposing = function(evt) {};
	
	/**
	Called when the Chat object has encountered an error, the chat message was terminated in an unexpected manner.
	@event
	@type function
	@param evt Error event.
	@param {String} evt.type "error".
	@param {Chat.Error} evt.reason Error code.
	@param {Object} evt.target Proximal event target.
	@example
chat.onerror = function(evt) {
	switch (evt.reason) {
		case Chat.Error.NETWORK_FAILURE:
			// Handle
			break;
		case Chat.Error.INVALID_USER:
			// Handle
			break;
		// ...
	}
};
	*/
	Chat.prototype.onerror = function(evt) {};
	
	/**
	GroupChat is a generic handler for chatting in a conference. GroupChat allows for sending and receiving chat messages, media messages, is-composing events.
	GroupChat users are allowed to freely leave and rejoin the group chat session as long as there is still 1 connected member in the conference.
	The administrator (creator) can invite new members into this group chat by calling {@link GroupChat#add}. This is a private constructor.
	@class GroupChat is a generic handler for chatting in a conference. GroupChat allows for sending and receiving chat messages, media messages, is-composing events.
	GroupChat users are allowed to freely leave and rejoin the group chat session as long as there is still 1 connected member in the conference.
	The administrator (creator) can invite new members into this group chat by calling {@link GroupChat#add}. This is a private constructor. <br />
	@extends Chat
	@property {Boolean} isOwner returns true if the user is the creator of the GroupChat
	@property {GroupChat.State} state The group chat session's current state (readonly)
	@property {String} subject The subject of the group chat
	@property {String} confID The current group chat's identifier
	@property {Array} members An array of members and their state (invited, connected, disconnected)
	@param {MediaServices} mediaServices Object that created this GroupChat object
	@param {String} subject The subject of the group chat
	@param {Array} recipients The group chat invites
	@param {String} owner The identifier of the owner of this group chat conference
	@param {String} [confID] Include this parameter if joining an active conference
	*/
	GroupChat = function(mediaServices, subject, recipients, owner, confID) {
		var _subject = subject,
			_confID = confID;
	
		this._members = [];
		
		this._isOwner = false;
	
		Chat.prototype.constructor.call(this, mediaServices, recipients);
		
		Object.defineProperty(this, "isOwner", {
			get: function() { return this._isOwner; }
		});
		
		/**
		@field subject
		The subject of the group chat
		*/
		Object.defineProperty(this, "subject", {
			get: function() { return _subject; },
			set: function(newSubject) {_subject = newSubject;}
		});
		
		/**
		@field confID
		The current group chat's identifier
		*/
		Object.defineProperty(this, "confID", {
			get: function() { return _confID; },
			set: function(newConfID) {_confID = newConfID;}
		});
		
		/**
		@field members
		An array of members and their state
		*/
		Object.defineProperty(this, "members", {
			get: function() { return this._members; }
		});
	};
	
	// Import all methods from Chat
	GroupChat.prototype = new Chat;
	GroupChat.prototype.constructor = GroupChat;
	
	/**
	@namespace Describes the states of GroupChat
	*/
	GroupChat.State = {};
	
	/**
	The GroupChat session is new.
	*/
	GroupChat.State.NEW = 0;
	
	/**
	The GroupChat session is ready.
	*/
	GroupChat.State.IN_PROGRESS = 1;
	
	/**
	The GroupChat sesion has ended.
	*/
	GroupChat.State.ENDED = 2;
	
	/**
	The GroupChat object encountered an error (see {@link GroupChat.Error} for more details).
	*/
	GroupChat.State.ERROR = 3;
	
	/**
	@namespace Describes the error of a GroupChat session.
	*/
	GroupChat.Error = {};
	
	/**
	General network failure
	*/
	GroupChat.Error.NETWORK_FAILURE = 0;
	
	/**
	The initiator starts the group chat session by sending group chat invitations to the specified members.
	@return void
	@example
var groupchat = service.createGroupChat("This is a new group chat!", ["sip:491728885004@mns.ericsson.ca", "sip:491728885005@mns.ericsson.ca"]);
groupchat.start();
	*/
	GroupChat.prototype.start = function() {
		var groupChat = this;
		
		var messageURL = this._url + '/' + GROUP_CHAT_CREATE;
		
		// Create and send a create conference request
		var req = new _CreateXmlHttpReq();
		
		var message = {
			members : this.recipient,
			subject : this.subject
		};
		
		req.open("POST", messageURL, true);
		req.setRequestHeader("Accept", "application/json, text/html");
		req.setRequestHeader("Content-Type", "application/json");
		req.send(JSON.stringify(message, null, " "));
		
		// On response
		req.onreadystatechange = function() {
			if (req.readyState == 4) {
				// Success response 200 No content
				if (req.status == 202) {
					
					// Extract the confID from JSON body
					var json = JSON.parse(req.responseText);
					var confId = json.confId;
					groupChat.confID = confId;					
					
					// Put it in the HashMap
					groupChat._mediaServices._chat.put(confId, groupChat);
					
					// Update all members as "invited"
					for (var i = 0; i < groupChat.recipient.length; i++) {
						groupChat.members.push({ entity: groupChat.recipient[i], status: "invited" });
					}
					groupChat.state= GroupChat.State.NEW;
				} else {
					var json = JSON.parse(req.responseText);
					logger.log("Create group chat fail reason: " + json.reason);						
					_InternalError(groupChat, GroupChat.Error.NETWORK_FAILURE);
				}
			}
		};
	};
	
	/**
	Leave the current group chat session.
	@return void
	@throws {Error} No active group chat session to leave
	@example
groupchat.leave();
	*/
	GroupChat.prototype.leave = function() {
		var groupChat = this;
		
		if (!this.confID) {
			throw new Error("No active group chat session to leave");
		}
		
		var messageURL = this._url + '/' + GROUP_CHAT_LEAVE;
		
		logger.log("Leaving group chat...");
		
		// Create and send a create conference request
		var req = new _CreateXmlHttpReq();
		
		var body = {
			confId : this.confID
		};

		req.open("POST", messageURL, true);
		req.setRequestHeader("Accept", "application/json, text/html");
		req.setRequestHeader("Content-Type", "application/json");
		req.send(JSON.stringify(body, null, " "));
	
		// On response
		req.onreadystatechange = function() {
			if (req.readyState == 4) {
				// Success response 200 No content
				if (req.status == 204) {
					groupChat.state = GroupChat.State.ENDED;
					
					// Remove it from the HashMap
					groupChat._mediaServices._chat.remove(groupChat.confID);
					
					logger.log("Leave group chat successful");
				} else {
					var json = JSON.parse(req.responseText);
					logger.log("Leave group chat unsuccessful: " + json.reason);				
					
					_InternalError(groupChat, GroupChat.Error.NETWORK_FAILURE);
				}
			}
		};
	};
	
	/**
	Add a participant(s) to the current group chat session. Only the administrator should be able to do this.
	@return void
	@param {Array} members A list of members to be added to the group chat session.
	@throws {Error} Failed to add member in an ongoing group chat session, no new member defined
	@throws {Error} Not allowed to add participant you are not the owner of the conference
	@throws {Error} Unable to add existing member to chat
	@example
groupchat.add(["sip:491728885004@mns.ericsson.ca"]);
	*/
	GroupChat.prototype.add = function(members) {
		var _groupChat = this;

		if (typeof(members) != "object" || !members || members.length == 0) {
			throw new Error("Failed to add member in an ongoing group chat session, no new member defined");
		}
		if (!this._isOwner) {
			throw new Error("Not allowed to add participant you are not the owner of the conference");
		}
		
		var newMembers = [];
		// Check if members to add already exist in the active recipient list
		for (var i = 0; i < members.length; i++ ) {
			var member = members[i];
			
			for (var j = 0; j < this.members.length; j++) {
				if (this.members[j].entity.indexOf(member) == -1) {
					// Doesn't exist
					newMembers.push(member);
					break;
				}
			}
		}
		
		if (newMembers.length == 0) {
			throw new Error("Unable to add existing member to chat");
		}
		
		logger.log("Adding participants to group chat");
		
		var messageURL = this._url + '/' + GROUP_CHAT_ADD;
		
		// Create and send a create conference request
		var req = new _CreateXmlHttpReq();
				
		var message = {
			confId : this.confID,
			members : newMembers
		};
		
		req.open("POST", messageURL, true);
		req.setRequestHeader("Accept", "application/json, text/html");
		req.setRequestHeader("Content-Type", "application/json");
		req.send(JSON.stringify(message, null, " "));
	
		// On response
		req.onreadystatechange = function() {
			if (req.readyState == 4) {
				// Success response 204 No content
				if (req.status == 204) {
					logger.log("Add participant successful");
				} else {
					var json = JSON.parse(req.responseText);
					logger.log("Add participant unsuccessful: " + json.reason);
					
					_InternalError(_groupChat, GroupChat.Error.NETWORK_FAILURE);
				}
			}
		};
	};
	
	/**
	Join is used to re-join a group chat session for which the user has previously left.
	@return void
	@throws {Error} Invalid conference ID
	@example
groupChat.join();
	*/
	GroupChat.prototype.join = function() {
		var groupChat = this;
		
		if (!this.confID || typeof(this.confID) != "string") {
			throw new Error("Invalid conference ID");
		}
		
		logger.log("Joining group chat " + this.confID + "...");
		
		var messageURL = this._url + '/' + GROUP_CHAT_JOIN;
		
		// Create and send a create conference request
		var req = new _CreateXmlHttpReq();
		
		var message = {
			confId : this.confID
		};

		req.open("POST", messageURL, true);
		req.setRequestHeader("Accept", "application/json, text/html");
		req.setRequestHeader("Content-Type", "application/json");
		req.send(JSON.stringify(message, null, " "));
	
		// On response
		req.onreadystatechange = function() {
			if (req.readyState == 4) {
				// Success response 202 Accepted
				if (req.status == 202) {
					logger.log("Join successful");
					
					groupChat.state = GroupChat.State.IN_PROGRESS;
					
					groupChat._mediaServices._chat.put(groupChat.confID, groupChat);
				} else {
					var json = JSON.parse(req.responseText);
					logger.log("Join unsuccessful: " + json.reason);
					
					_InternalError(groupChat, GroupChat.Error.NETWORK_FAILURE);
				}
			}
		};
	};
	
	/**
	Accept an invitation to a group chat session. The user will automatically join the active conference and will be able to start sending messages.
	@return void
	@throws {Error} Unable to join group chat with invalid ID
	@example
service.oninvite = function(evt) {
	if (evt.groupChat) {
		evt.groupChat.accept();
	}
};
	*/
	GroupChat.prototype.accept = function() {
		var groupChat = this;
		
		if (!this.confID) {
			throw new Error("Unable to join group chat with invalid ID");
		}
		
		logger.log("Accepting...");
		
		var messageURL = this._url + '/' + GROUP_CHAT_ACCEPT;
			
		// Create and send a create conference request
		var req = new _CreateXmlHttpReq();
		
		var message = {
			confId : this.confID
		};
		
		req.open("POST", messageURL, true);
		req.setRequestHeader("Accept", "application/json, text/html");
		req.setRequestHeader("Content-Type", "application/json");
		req.send(JSON.stringify(message, null, " "));
		
		// On response
		req.onreadystatechange = function() {
			if (req.readyState == 4) {
				// Success response 200 OK
				if (req.status == 200 || req.status == 201) {
					logger.log("Accept successful");
					
					// Put it in the HashMap
					groupChat._mediaServices._chat.put(groupChat.confID, groupChat);
				} else {
					var json = JSON.parse(req.responseText);
					logger.log("Accept unsuccessful: " + json.reason);
					
					_InternalError(groupChat, GroupChat.Error.NETWORK_FAILURE);
				}
			}
		};
		
	};
	
	/**
	Decline an invitation to a group chat session.
	@return void
	@throws {Error} Failed to decline invitation to group chat, no conferenceID
	@example
service.oninvite = function(evt) {
	if (evt.groupChat) {
		evt.groupChat.decline();
	}
};
	*/
	GroupChat.prototype.decline = function() {
		var groupChat = this;
		
		if (!this.confID) {
			throw new Error("Failed to decline invitation to group chat, no conferenceID");
		}
		
		logger.log("Declining group chat invite...");
		
		var messageURL = this._url + '/' + GROUP_CHAT_DECLINE;
			
		// Create and send a create conference request
		var req = new _CreateXmlHttpReq();
				
		var message = {
			confId : this.confID
		};

		req.open("POST", messageURL, true);
		req.setRequestHeader("Accept", "application/json, text/html");
		req.setRequestHeader("Content-Type", "application/json");
		req.send(JSON.stringify(message, null, " "));
	
		// On response
		req.onreadystatechange = function() {
			if (req.readyState == 4) {
				// Success response 204 No content
				if (req.status == 204) {
					groupChat.state = GroupChat.State.ENDED;
					
					logger.log("Decline group chat invite successful");
					
					// Remove it from the HashMap
					groupChat._mediaServices._chat.remove(groupChat.confID);
				} else {
					var json = JSON.parse(req.responseText);
					logger.log("Decline group chat invite unsuccessful: " + json.reason);
					
					_InternalError(groupChat, GroupChat.Error.NETWORK_FAILURE);
				}
			}
		};
	};
	
	/**
	Called when the GroupChat has ended
	@event
	@type function
	@param evt
	@example
groupchat.onend = function(evt) {
	// GroupChat has ended
};
	*/
	GroupChat.prototype.onend = function(evt) {};
	
	/**
	Called when a user has joined/left the current group chat session
	@event
	@type function
	@param evt
	@param {Array} evt.members Array of members and their state
	@param {String} evt.members.entity Identifier of member in the group chat
	@param {String} evt.members.status Status of the member ("invited", "connected", "disconnected")
	@example
groupchat.onupdate = function(evt) {
	// A crude example...
	if (evt.members[0].status == "disconnected") {
		alert(evt.members[0].entity + "has disconnected from the chat");
	}
}
	*/
	GroupChat.prototype.onupdate = function(evt) {};

	/**
	A new ContactList object is created upon registration, assuming the user has an address book. The user's ContactList can be accessed from 
	{@link MediaServices.contactList}.
	@class
	@param {MediaServices} mediaServices The parent MediaServices instance.
	@property {Number} size The size of the contact list
	@property {Array} contact An array of Contact objects
	@property {ContactList.State} state The state of the contact list
	@example
var contactList = service.contactList;
contactList.onstatechange = function(evt) {};
contactList.onready = function(evt) {};
contactList.onpresenceinvite = function(evt) {};
contactList.update();
contactList.getAllAvatars();
	*/
	ContactList = function(mediaServices) {
		var _state = ContactList.State.NEW;
		
		this._url = null;
		
		/**
		An array of Contact objects
		*/
		this._contacts = [];
		
		/**
		Current syncId, used for contact list requests
		*/
		this._syncId = null;
		
		/**
		Parent MediaServices object
		*/
		this._mediaServices = mediaServices;
		
		/**
		@field size
		Amount of Contacts in ContactList
		*/
		Object.defineProperty(this, "size", {
			get: function() { return this._contacts.length; }
		});
		
		/**
		@field contact
		Contact array
		*/
		Object.defineProperty(this, "contact", {
			get: function() { return this._contacts; }
		});
		
		/**
		@field state
		*/
		Object.defineProperty(this, "state", {
			get: function()
			{
				return _state;
			},
			set: function(newState)
			{
				_state = newState;
				
				if (typeof(this.onstatechange) == "function"){
					var evt = {type: "statechange", oldState : _state, state: newState};
					this.onstatechange(evt);
				}
				// Dispatch appropriate states
				if (newState == ContactList.State.READY && typeof(this.onready) == "function")
					this.onready({ contactList : this });
				// else if (newState == ContactList.State.UPDATED && typeof(this.onupdate) == "function")
					// this.onupdate({ contactList : this });
			}
		});
	};
	
	/**
	@namespace Describes the states of the ContactList object.
	*/
	ContactList.State = {};
	
	/**
	The ContactList has been initialized.
	*/
	ContactList.State.NEW = 0;
	
	/**
	The ContactList has been updated and is ready.
	*/
	ContactList.State.READY = 1;
	
	/**
	The ContactList has encountered an error.
	*/
	ContactList.State.ERROR = 2;
	
	/**
	Retrieves the network address book
	@function
	@return void
	@example
service.contactList.update();
	*/
	ContactList.prototype.update = function() {
		var url = this._url + ADDRESSBOOK_RESOURCE + '/' + ADDRESSBOOK_RESOURCE_CONTACTS;
		
		if (this._syncId) {
			// TODO: uncomment below
			// url += '?syncId=' + this._syncId;
		}
		
		logger.log("Updating contact list...");
		
		// Create and send an update contact list request
		var req = new _CreateXmlHttpReq();
		
		req.open("GET", url, true);
		req.setRequestHeader("Accept", "application/json, text/html");
		req.send(null);
	
		// On response
		req.onreadystatechange = function() {
			if (req.readyState == 4) {
				// Success response 202 Accepted
				if (req.status == 202) {
					logger.log("Update contact list finished");
				} else {
					var json = JSON.parse(req.responseText);
					logger.log("Update contact list failed: " + json.reason);
				}
			}
		};
	};
	
	/**
	Builds contact list from a contactlist event
	@private
	*/
	ContactList.prototype._parseContactList = function(contacts) {
		var size = this.size;
		var isUpdated = false;
	
		for (var j = 0;; j++) {
			try {
				var contact = contacts[j];
				var isContactList = false;
				
				// Check ContactList for that contact
				for (var l = 0; l < this.size; l++) {
					if (this.contact[l]._id == _GetNumber(contact.uri)) {
						// Update the Presence relationship state
						this.contact[l]._presenceState = contact.state;
						isContactList = true;
						isUpdated = true;
					}
				}
				
				// Contact doesn't exist locally
				if (!isContactList) {
					// Create a new entry
					var info = {
						numbers : [{
							number : contact.uri
						}]
					};
					var newContact = new Contact(info);
					newContact._mediaServices = this._mediaServices;
					newContact._url = this._url;
					newContact._id = _GetNumber(contact.uri);
					
					if (contact.self == "true") {
						newContact._isSelf = true;
					}
					
					// Add to local ContactList (not network address book)
					this.contact.push(newContact);
				}
			} catch (error) {
				// No more contact updates
				break;
			}
		}
		
		// Change state to ready if contact list was updated
		if (this.size != size || isUpdated) {
			this.state = ContactList.State.READY;
		}
	};
	
	/**
	Builds contact list from the network address book. Called on address book channel event.
	@private
	*/
	ContactList.prototype._parseAddressBook = function(contacts) {
		var isUpdated = false;
	
		for (var i = 0;; i++) {
			try {
				var info = contacts[i];
				var contact = null;
				
				if (this._contacts[info.contactId]) {
					// Contact already exists, update him
					contact = this._contacts[info.contactId];
					contact.state = Contact.State.UPDATING;
					
					// Set info
					if (info.vcard) {
						contact.name = info.vcard.name;
						contact.emails = info.vcard.emails;
						contact.addresses = info.vcard.addresses;
						contact.note = info.vcard.note;
						contact.numbers = info.vcard.numbers;
						
						if (info.vcard.photo) {
							// photo is already base 64 encoded
							contact.photo = 'data:image/' + info.vcard.photoType + ';base64,' + info.vcard.photo;
						}
					}
				} else {
					// Contact doesn't exist in our list, create a new entry
					contact = new Contact(info.vcard);
					contact._url = this._url;
					contact._mediaServices = this._mediaServices;
				}
				
				// Set the contactId as the array location
				contact._contactId = info.contactId;
				
				var self = _GetNumber(this._mediaServices.username);
				
				// Get the main ID of that contact and check if it is self
				if (info.vcard.numbers) {
					var number = null;
					
					// Get the primary number of this contact
					for (var j in info.vcard.numbers) {
						if (info.vcard.numbers[j].primary) {
							number = _GetNumber("tel:" + info.vcard.numbers[j].number);
							
							if (number == self && !contact._id) {
								contact._isSelf = true;
								contact._id = _GetNumber("tel:" + info.vcard.numbers[j].number);
							}
						}
					}
					
					// No primary number, just grab the first one
					if (number == null) {
						number = _GetNumber("tel:" + info.vcard.numbers[0].number);
						
						if (number == self) {
							contact._isSelf = true;
						}
					}
					
					if (!contact._id) {
						contact._id = number;
					}
				}
				
				// Insert it into the contact list at the position of the ID if it doesn't exist yet
				if (!this._contacts[info.contactId]) {
					this._contacts[info.contactId] = contact;
				}
				
				contact.state = Contact.State.UPDATED;
				
				isUpdated = true;
			} catch (error) {
				// No more contacts in the list
				break;
			}
		}
		
		// Done parsing, callback to notify of changes
		if (isUpdated) {
			this.state = ContactList.State.READY;
		}
	};
	
	/**
	Parse Presence List event
	@private
	*/
	ContactList.prototype._parsePresenceList = function(userPresences) {
		var cl = this;
		var isUpdated = false;
		
		for (var i = 0;; i++) {
			try {
				var presence = userPresences[i];
				
				if (typeof(presence) == "undefined") {
					// No more userPresences
					break;
				}
				
				var user = _GetNumber(presence.entity);
				
				// Store presence information into contact the correct contact in our list
				for (var j = 0; j < this.size; j++) {
					if (this.contact[j]._id == user) {
						this.contact[j].state = Contact.State.UPDATING;
					
						// Get Avatar of users in the presence list
						if (presence.person.statusIconEtag == "0") {
							this.contact[j]._avatar = null;
							cl.state = ContactList.State.READY;
						} else if (presence.person.statusIconEtag) {
							if (!this.contact[j].avatar || presence.person.statusIconEtag != this.contact[j].presence.statusIconEtag) {
								this.contact[j].presence = presence.person;
								
								// TODO: there is a bug in WCG that returns the wrong statusIconUrl
								this.contact[j].presence.statusIconUrl = 
									presence.person.statusIconUrl.substring(presence.person.statusIconUrl.indexOf("content/getavatar/"), presence.person.statusIconUrl.length);
								this.contact[j].services = presence.services;
								
								// Get the avatar if no avatar or if the avatar has changed
								this.contact[j].getAvatar(function(status) {
									if (status.success == true) {
										cl.state = ContactList.State.READY;
									}
								});
							}
						}
						
						this.contact[j].presence = presence.person;
						this.contact[j].services = presence.services;
						
						// If self
						if (presence.self == "true") {
							this.contact[j]._isSelf = true;
							this._mediaServices._tagline = presence.person.freeText;
							this._mediaServices._homepage = presence.person.homepage;
							this._mediaServices._willingness = presence.person.willingness;
						}
						
						this.contact[j].state = Contact.State.UPDATED;
					} else {
						// TODO: user doesn't exist in our ContactList? Is this possible?
					}
				}
				
				isUpdated = true;
			} catch (error) {
				// No more userPresences
				break;
			}
		}
		
		// Done parsing, callback to notify of changes
		if (isUpdated) {
			this.state = ContactList.State.READY;
		}
	};
	
	/**
	Add user to network address book and local contact list.
	@param {Contact} contact The contact to add into our contact list
	@return void
	@throws {Error} Invalid contact
	@example
var contact = new Contact(info);
contactList.add(contact);
	*/
	ContactList.prototype.add = function(contact) {
		if (!contact || !(contact instanceof Contact)) {
			throw new Error("Invalid contact");
		}
		
		var url = this._url + ADDRESSBOOK_RESOURCE + '/' + ADDRESSBOOK_RESOURCE_CONTACTS;
		var cl = this;
		
		logger.log("Adding contact...");
		
		var body = {
			vcard : {
				name : contact.name,
				numbers : contact.numbers,
				emails : contact.emails,
				addresses : contact.addresses,
				note : contact.note
			},
			syncId : this._syncId
		};
		
		// Create and send an add contact request
		var req = new _CreateXmlHttpReq();
		
		req.open("POST", url, true);
		req.setRequestHeader("Accept", "application/json, text/html");
		req.setRequestHeader("Content-Type", "application/json");
		req.send(JSON.stringify(body, null, " "));
	
		// On response
		req.onreadystatechange = function() {
			if (req.readyState == 4) {
				var json = JSON.parse(req.responseText);
				
				// Success response 201 Created
				if (req.status == 201) {
					logger.log("Add contact successful");
					cl._syncId = json.syncId;
					contact._contactId = json.contactId;
					
					// Put it in the array after add successful
					cl.contact[contact._contactId] = contact;
				} else {
					logger.log("Add contact failed: " + json.reason);
					
					// TODO: error
				}
			}
		};
	};
	
	/**
	Remove user from network address book and local contact list, and unfollows user as well.
	@function
	@param {Contact} contact Contact to remove
	@throws {Error} Invalid contact
	@throws {Error} Unable to perform action to self
	@return void
	@example
var contact = contactList.contact[0];
contactList.remove(contact);
	*/
	ContactList.prototype.remove = function(contact) {
		if (!contact || !(contact instanceof Contact)) {
			throw new Error("Invalid contact");
		}
		if (contact.isSelf) {
			throw new Error("Unable to perform action to self");
		}
		
		// Remove user from presence list
		contact.unfollow();
		
		if (contact._contactId === "") {
			// No contactId, the user isn't in the address book
			var contactIndex = this.contact.indexOf(contact);
			if (contactIndex != -1) {
				// Remove from local ContactList
				this.contact.splice(contactIndex, 1);
				logger.log("Remove contact successful");
				
				return;
			} else {
				throw new Error("Invalid contact");
			}
		}
		
		var url = this._url + ADDRESSBOOK_RESOURCE + '/' + ADDRESSBOOK_RESOURCE_CONTACTS + '/' + contact._contactId;
		
		logger.log("Removing contact...");
		
		var body = {
			syncId : this._syncId
		};
		
		// Create and send an add contact request
		var req = new _CreateXmlHttpReq();
		
		req.open("DELETE", url, true);
		req.setRequestHeader("Accept", "application/json, text/html");
		req.setRequestHeader("Content-Type", "application/json");
		req.setRequestHeader("X-http-method-override", "DELETE");
		req.send(JSON.stringify(body, null, " "));
	
		// On response
		req.onreadystatechange = function() {
			if (req.readyState == 4) {
				// Success response 200 OK
				if (req.status == 200) {
					logger.log("Remove contact successful");
					// cl._syncId = json.syncId;
				} else {
					var json = JSON.parse(req.responseText);
					logger.log("Remove contact failed: " + json.reason);
					
					// TODO: error
				}
			}
		};
	};
	
	/**
	Modify contact information.
	@function
	@param {Contact} contact Contact object with modified information
	@throws {Error} Invalid contact
	@throws {Error} Unable to perform action to self
	@return void
	@example
var contact = contactList.contact[0];
contact.name.given = "bob";
contactList.modify(contact);
	*/
	ContactList.prototype.modify = function(contact) {
		if (!contact || !(contact instanceof Contact)) {
			throw new Error("Invalid contact");
		}
		if (contact.isSelf) {
			throw new Error("Unable to perform action to self");
		}
		
		var url = this._url + ADDRESSBOOK_RESOURCE + '/' + ADDRESSBOOK_RESOURCE_CONTACTS + '/' + contact._contactId;
		
		logger.log("Modifying contact...");
		
		var body = {
			vcard : {
				name : contact.name,
				numbers : contact.numbers,
				emails : contact.emails,
				addresses : contact.addresses,
				note : contact.note
			},
			// contactId : contact.id,
			syncId : this._syncId
		};
		
		// Create and send an add contact request
		var req = new _CreateXmlHttpReq();
		
		req.open("POST", url, true);
		req.setRequestHeader("Accept", "application/json, text/html");
		req.setRequestHeader("Content-Type", "application/json");
		req.send(JSON.stringify(body, null, " "));
	
		// On response
		req.onreadystatechange = function() {
			if (req.readyState == 4) {
				// Success response 200 OK
				if (req.status == 200) {
					logger.log("Modify contact successful");
					// cl._syncId = json.syncId;
				} else {
					var json = JSON.parse(req.responseText);
					logger.log("Modify contact failed: " + json.reason);
					
					// TODO: error
				}
			}
		};
	};
	
	/**
	Fetches all avatars of all users with a presence relationship.
	@function
	@return void
	@example
contactList.getAllAvatars();
	*/
	ContactList.prototype.getAllAvatars = function() {
		var cl = this;
	
		for (var i = 0; i < cl.contact.length; i++) {
			// Can only get avatars of users with presence relationship
			if (cl.contact[i].presence) {
				cl.contact[i].getAvatar(function(status) {
					if (status.success == true) {
						cl.state = ContactList.State.READY;
					}
				});
			}
		}
	};
	
	/**
	Called when the ContactList object changes its state.
	@event
	@type function
	@param evt An event describing the state change.
	@param {String} evt.type "statechange".
	@param {Chat.State} evt.newState New state.
	@param {Chat.State} evt.oldState Old state.
	@example
contactList.onstatechange = function(evt) {
	switch (evt.newState) {
		case ContactList.State.READY:
			// ContactList state has changed to READY
			break;
		case ContactList.State.ERROR:
			// ContactList state has changed to ERROR
			break;
		// ...
	}
};
	*/
	ContactList.prototype.onstatechange = function(evt) {};
	
	/**
	Called when the ContactList object is ready and has been updated with new Contact information.
	@event
	@type function
	@param evt
	@param {ContactList} evt.contactList The ContactList object
	@example
contactList.onready = function(evt) {
	if (evt.contactList) {
		// Do stuff with the ContactList and Contacts
	}
};
	*/
	ContactList.prototype.onready = function(evt) {};
	
	/**
	A presence follow request has been received
	@event
	@type function
	@param evt
	@param {Array} evt.contacts An array of Contact objects
	@example
contactList.onpresenceinvite = function(evt) {
	var contact = evt.contacts[0];
	contactList.add(contact);
	contact.follow();
};
	*/
	ContactList.prototype.onpresenceinvite = function(evt) {};
	
	/**
	TODO: to complete
	*/
	ContactList.prototype.onerror = function(evt) {};
	
	/**
	A new contact is created from a JSON object. This is a public constructor.
	@class A new contact is created from a JSON object. This is a public constructor.
	@param {Object} info An object containing a contact's info
	@property {Contact.State} state State of the contact
	@property {Object} name Object containing the name of the contact (has the following properties: name.given, name.family, name.middle, name.prefixes, name.suffixes)
	@property {Array} numbers Array containing the numbers of the contact (has the following properties: numbers.number, numbers.type, numbers.primary)
	@property {Array} emails Array containing the emails of the contact (has the following properties: emails.email, emails.type, emails.primary)
	@property {Array} addresses Array containing the addresses of the contact (has the following properties: addresses.type, addresses.pobox, addresses.street, addresses.ext-street, addresses.locality, addresses.region, addresses.postalcode, addresses.country)
	@property {String} note A note added to the contact
	@property {String} org Organization the contact belongs to
	@property {String} title The title of the contact
	@property {String} birthday The birthday date of the contact (format: yyyy-mm-dd)
	@property {String} photo A base 64 encoded data uri of the contact's photo
	@property {String} presenceState The state of the presence relationship with this contact (one of "active", "pending" or "terminated")
	@property {Object} presence The presence information of the contact (has the following properties: presence.willingness, presence.displayName, presence.statusIconUrl, presence.statusIconEtag, presence.freeText, presence.statusIconContentType, presence.statusIconFileSize, presence.homepage, presence.opdLinks)
	@property {Array} services An array of services published (as defined by RCS standards) by the contact (has the following properties: services.serviceStatus, services.serviceDescription, services.serviceVersion)
	@property {Boolean} isSelf Is this contact the user's self
	@property {Object} avatar A base 64 encoded data uri of the contact's avatar
	@example
var info = {
	"name":
		{"given": "givenName",
		"family": "familyName"},
	"addresses":[
		{
		"type": "HOME",
			"street": "a street",
			"locality": "a town",
			"region": "a region",
			"postalcode": "a postal code",
			"country": "a country"}],
	"numbers": [
		{
		"number": "1",
		"type": "MOBILE_HOME",
		"primary": "false"},
		{
		"number": "3",
		"type": "MOBILE_WORK",
		"primary": "true"},
		{
		"number": "2",
		"type": "HOME",
		"primary": "false"}],
	"emails": [
		{
		"email": "1@domain.com",
		"type": "WORK",
		"primary": "true"}],
	"note":"a note"
};
var contact = new Contact(info);
	*/
	Contact = function(info) {
		var _state = Contact.State.NEW,
			_name = null,
			_numbers = [],
			_emails = [],
			_addresses = [],
			_note = "",
			_org = "",
			_title = "",
			_birthday ="",
			_photo = "",
			_presence = null, // RCS Presence attributes for this contact
			_services = null; // RCS Presence services
		
		if (info) {
			_name = info.name;
			_numbers = info.numbers;
			_emails = info.emails;
			_addresses = info.addresses;
			_note = info.note;
			_org = info.org;
			_title = info.title;
			_birthday = info.birthday;
			
			if (info.photo) {
				_photo = 'data:image/' + info.photoType + ';base64,' + info.photo;
			}
		}
		
		this._mediaServices = null;
		
		/**
		WCG URL for Presence list
		*/
		this._url = null;
		
		/**
		Is the user self (boolean)
		*/
		this._isSelf = false;
		
		/**
		The contact's telephone number
		*/
		this._id = "";
		
		/**
		address book contactId (array location)
		*/
		this._contactId = "";
		
		/**
		active, pending, terminated
		*/
		this._presenceState = "";
		
		/**
		avatar file data uri base 64 encoded
		*/
		this._avatar = null;
		
		/**
		@field state
		*/
		Object.defineProperty(this, "state", {
			get: function() {
				return _state;
			},
			set: function(newState)
			{
				_state = newState;
				
				if (typeof(this.onstatechange) == "function") {
					var evt = {type: "statechange", oldState : _state, state: newState};
					this.onstatechange(evt);
				}
				
				if (newState == Contact.State.UPDATING && typeof(this.onupdating) == "function") {
					this.onupdating({ contact : this });
				}
				else if (newState == Contact.State.UPDATED && typeof(this.onupdate) == "function") {
					this.onupdate({ contact : this });
				}
			}
		});
		
		/**
		@field name
		*/
		Object.defineProperty(this, "name", {
			get: function() { return _name; },
			set: function(name) { _name = name; }
		});
		
		/**
		@field numbers
		*/
		Object.defineProperty(this, "numbers", {
			get: function() { return _numbers; },
			set: function(numbers) { _numbers = numbers; }
		});
		
		/**
		@field emails
		*/
		Object.defineProperty(this, "emails", {
			get: function() { return _emails; },
			set: function(emails) { _emails = emails; }
		});
		
		/**
		@field addresses
		*/
		Object.defineProperty(this, "addresses", {
			get: function() { return _addresses; },
			set: function(addresses) { _addresses = addresses; }
		});
		
		/**
		@field note
		*/
		Object.defineProperty(this, "note", {
			get: function() { return _note; },
			set: function(note) { _note = note; }
		});
		
		/**
		@field org
		*/
		Object.defineProperty(this, "org", {
			get: function() { return _org; },
			set: function(org) { _org = org; }
		});
		
		/**
		@field title
		*/
		Object.defineProperty(this, "title", {
			get: function() { return _title; },
			set: function(title) { _title = title; }
		});
		
		/**
		@field birthday
		*/
		Object.defineProperty(this, "birthday", {
			get: function() { return _birthday; },
			set: function(birthday) { _birthday = birthday; }
		});
		
		/**
		@field photo
		Data URI format of the photo
		*/
		Object.defineProperty(this, "photo", {
			get: function() { return _photo; },
			set: function(photo) { _photo = photo; }
		});
		
		/**
		@field presenceState
		*/
		Object.defineProperty(this, "presenceState", {
			get: function() { return this._presenceState; }
		});
		
		/**
		@field presence
		Presence information
		*/
		Object.defineProperty(this, "presence", {
			get: function() { return _presence; },
			set: function(presence) { _presence = presence; }
		});
		
		/**
		@field services
		Services information from presence
		*/
		Object.defineProperty(this, "services", {
			get: function() { return _services; },
			set: function(services) { _services = services; }
		});
		
		/**
		@field isSelf
		*/
		Object.defineProperty(this, "isSelf", {
			get: function() { return this._isSelf; }
		});
		
		/**
		@field avatar
		*/
		Object.defineProperty(this, "avatar", {
			get: function() { return this._avatar; }
		});
	};
	
	/**
	@namespace Describes the states of the Contact object.
	*/
	Contact.State = {};
	
	/**
	The Contact object has been newly created
	*/
	Contact.State.NEW = 0;
	
	/**
	The Contact object is being updated after receiving new information from the server
	*/
	Contact.State.UPDATING = 1;
	
	/**
	The Contact object has been updated with new information
	*/
	Contact.State.UPDATED = 2;
	
	/**
	Subscribe to this contact's Presence.
	@function
	@return void
	@throws {Error} Unable to perform action to self
	@example
contact = contactList.contact[0];
contact.follow();
	*/
	Contact.prototype.follow = function() {
		if (this.isSelf) {
			throw new Error("Unable to perform action to self");
		}
	
		var url = this._url + PRESENCE_RESOURCE + '/' + PRESENCE_RESOURCE_LIST + '/' + PRESENCE_RESOURCE_LIST_ADD;
		
		logger.log("Following contact...");
		
		var body = {
			username : "tel:+" + this._id
		};
		
		// Create and send a follow contact request
		var req = new _CreateXmlHttpReq();
		
		req.open("POST", url, true);
		req.setRequestHeader("Accept", "application/json, text/html");
		req.setRequestHeader("Content-Type", "application/json");
		req.send(JSON.stringify(body, null, " "));
	
		// On response
		req.onreadystatechange = function() {
			if (req.readyState == 4) {
				// Success response 204 No Content
				if (req.status == 204) {
					logger.log("Follow contact request sent");
				} else {
					var json = JSON.parse(req.responseText);
					logger.log("Follow contact failed: " + json.reason);
					
					// TODO: error
				}
			}
		};
	};
	
	/**
	Unsubscribe from this contact's Presence
	@function
	@return void
	@throws {Error} Unable to perform action to self
	@example
contact = contactList.contact[0];
contact.unfollow();
	*/
	Contact.prototype.unfollow = function() {
		if (this.isSelf) {
			throw new Error("Unable to perform action to self");
		}
	
		var url = this._url + PRESENCE_RESOURCE + '/' + PRESENCE_RESOURCE_LIST + '/' + PRESENCE_RESOURCE_LIST_REMOVE;
		
		logger.log("Unfollowing contact...");
		
		var body = {
			username : "tel:+" + this._id
		};
		
		// Create and send a follow contact request
		var req = new _CreateXmlHttpReq();
		
		req.open("POST", url, true);
		req.setRequestHeader("Accept", "application/json, text/html");
		req.setRequestHeader("Content-Type", "application/json");
		req.send(JSON.stringify(body, null, " "));
	
		// On response
		req.onreadystatechange = function() {
			if (req.readyState == 4) {
				// Success response 204 No Content
				if (req.status == 204) {
					logger.log("Unfollow contact successful");
				} else {
					var json = JSON.parse(req.responseText);
					logger.log("Unfollow contact failed: " + json.reason);
					
					// TODO: error
				}
			}
		};
	};
	
	/**
	Ignore/block the Presence request from this contact
	@function
	@return void
	@throws {Error} Unable to perform action to self
	@example
contactList.onpresenceinvite = function(evt) {
	var contact = evt.contacts[0];
	contactList.add(contact);
	contact.block();
};
	*/
	Contact.prototype.block = function() {
		if (this.isSelf) {
			throw new Error("Unable to perform action to self");
		}
		
		var url = this._url + PRESENCE_RESOURCE + '/' + PRESENCE_RESOURCE_LIST + '/' + PRESENCE_RESOURCE_LIST_BLOCK;
		
		logger.log("Blocking contact...");
		
		var body = {
			username : "tel:+" + this._id
		};
		
		// Create and send a follow contact request
		var req = new _CreateXmlHttpReq();
		
		req.open("POST", url, true);
		req.setRequestHeader("Accept", "application/json, text/html");
		req.setRequestHeader("Content-Type", "application/json");
		req.send(JSON.stringify(body, null, " "));
	
		// On response
		req.onreadystatechange = function() {
			if (req.readyState == 4) {
				// Success response 204 No Content
				if (req.status == 204) {
					logger.log("Block contact successful");
				} else {
					var json = JSON.parse(req.responseText);
					logger.log("Block contact failed: " + json.reason);
					
					// TODO: error
				}
			}
		};
	};
	
	/**
	Fetch the contact's Presence avatar. The avatar will be stored in the Contact.avatar field, and will trigger an onupdate callback on success.
	@function
	@param {Function} [callback] A callback function, with signature <i>callback(evt)</i> to indicate whether the avatar was fetched successfully or not
	@throws {Error} User has no avatar
	@return void
	@example
contact.getAvatar(function(evt) {
	if (evt.success) {
		// Update the avatar of this contact
	}
});
	*/
	Contact.prototype.getAvatar = function(callback) {
		var contact = this;
		
		if (!this.presence.statusIconUrl)
			throw new Error("User has no avatar");
		
		var url = this._url + this.presence.statusIconUrl;
		
		logger.log("Getting avatar of " + this._id); 
		
		// Create and send a get avatar request
		var req = new _CreateXmlHttpReq();
		
		req.open("GET", url, true);
		req.setRequestHeader("Accept", "application/json, text/html");
		req.overrideMimeType("text/plain; charset=x-user-defined");
		req.send(null);
	
		// On response
		req.onreadystatechange = function() {
			if (req.readyState == 4) {
				// Success response 200 OK
				if (req.status == 200) {
					logger.log("Get avatar successful");
					
					var imgType = req.getResponseHeader("Content-Type");
					
					var newAvatar = 'data:' + imgType + ';base64,' + _Base64encode(req.responseText);
					
					// Update only if different from old avatar
					if (contact._avatar != newAvatar) {
						contact.state = Contact.State.UPDATING;
						contact._avatar = newAvatar;
						
						if (typeof(callback) == "function") {
							var event = {success : true, failure: false};
							callback(event);
						}
						
						contact.state = Contact.State.UPDATED;
					}
				} else {
					var json = JSON.parse(req.responseText);
					logger.log("Get avatar failed: " + json.reason);
					
					if (typeof(callback) == "function") {
						var event = {success : false, failure: true};
						callback(event);
					}
				}
			}
		};
	};
	
	/**
	The contact has been updated successfully with new information
	@event
	@type function
	@param evt
	@example
contact.onupdate = function(evt) {
	// The contact has been updated
};
	*/
	Contact.prototype.onupdate = function(evt) {};
	
	/**
	The contact is currently being updated with new information
	@event
	@type function
	@param evt
	@example
contact.onupdating = function(evt) {
	// The contact is being updated
};
	*/
	Contact.prototype.onupdating = function(evt) {};
	
	/**
	Generate a general error callback
	@private
	*/
	_InternalError = function(obj, code) {
		try {
			if (obj instanceof MediaServices) {
				obj.state = MediaServices.State.ERROR;
			} else if (obj instanceof Conference) {
				obj.state = Conference.State.ERROR;
			} else if (obj instanceof Call) {
				obj.state = Call.State.ERROR;
			} else if (obj instanceof FileTransfer) {
				obj.state = FileTransfer.State.ERROR;
			} else if (obj instanceof Chat) {
				obj.state = Chat.State.ERROR;
			} else if (obj instanceof GroupChat) {
				obj.state = GroupChat.State.ERROR;
			} else if (obj instanceof ContactList) {
				obj.state = ContactList.State.ERROR;
			} else if (obj instanceof Contact) {
				obj.state = Contact.State.ERROR;
			}
			
			if (typeof(obj.onerror) == "function") {
				var event = {type: "error", reason: code, target: obj};
				obj.onerror(event);
			}
		} catch (error) {
			logger.log("Invalid ERROR:"+error);
		}
	};
	
	/**
	Base 64 encoding of a String
	Source: http://stackoverflow.com/questions/7370943/retrieving-binary-file-content-using-javascript-base64-encode-it-and-reverse-de
	@private
	@param {String} str Input raw data
	@return {String} Base 64 encoded string
	*/
	_Base64encode = function(str) {
		var base64EncodeChars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
		var out, i, len;
		var c1, c2, c3;

		len = str.length;
		i = 0;
		out = "";
		while (i < len) {
			c1 = str.charCodeAt(i++) & 0xff;
			if (i == len) {
				out += base64EncodeChars.charAt(c1 >> 2);
				out += base64EncodeChars.charAt((c1 & 0x3) << 4);
				out += "==";
				break;
			}
			c2 = str.charCodeAt(i++);
			if (i == len) {
				out += base64EncodeChars.charAt(c1 >> 2);
				out += base64EncodeChars.charAt(((c1 & 0x3)<< 4) | ((c2 & 0xF0) >> 4));
				out += base64EncodeChars.charAt((c2 & 0xF) << 2);
				out += "=";
				break;
			}
			c3 = str.charCodeAt(i++);
			out += base64EncodeChars.charAt(c1 >> 2);
			out += base64EncodeChars.charAt(((c1 & 0x3)<< 4) | ((c2 & 0xF0) >> 4));
			out += base64EncodeChars.charAt(((c2 & 0xF) << 2) | ((c3 & 0xC0) >>6));
			out += base64EncodeChars.charAt(c3 & 0x3F);
		}
		return out;
	};
	
	/**
	Parse the media types used in createCall/createConference. Also checks for invalid services. 
	For example, if the call is created as an audio/video call, but the user has registered with only audio, 
	the call will be reduced to an audio call.
	@private
	@param {MediaServices} mediaServices The parent MediaServices object
	@param {Object} mediaType Media services object(e.g. {audio:true,video:true})
	@return {Object} Mediatypes allowed for this call/conference
	*/
	function _ParseMediaType(mediaServices, mediaType) {
		var parentMedia = mediaServices.mediaType.replace(/(\s)/g, "").split(",");
		var _mediaType = {};
		
		// Inherit media type, if undefined
		if (typeof(mediaType) == "undefined" || Object.keys(mediaType).length == 0) {
			if (parentMedia.indexOf("audio") != -1)
				_mediaType.audio = true;
			if (parentMedia.indexOf("video") != -1)
				_mediaType.video = true;
			
			return _mediaType;
		} else if (typeof(mediaType) != "object" || mediaType == "") {
			throw new Error("Invalid media types");
		}
		
		// Assert media type is allowed. E.g. If parent is only registered for audio, disallow "video" in mediaType.
		if (mediaType.audio) {
			if (mediaType.audio == true && parentMedia.indexOf("audio") != -1)
				_mediaType.audio = true;
		}
		if (mediaType.video) {
			if (mediaType.video == true && parentMedia.indexOf("video") != -1)
				_mediaType.video = true;
		}
		
		return _mediaType;
	}
	
	/**
	Determine the type(s) of media in the SDP by inspeting the "m" field of the SDP
	@private
	@param {Object} sdp An object containing SDP attributes.
	@return {Object} mediaType An array of media types.
	*/
	function _ParseSDPMedia(sdp) {
		// TODO: can know the media type from the a=group:BUNDLE audio video line
		// Find the a=group:BUNDLE line
		// set mediaType.audio = true and/or mediaType.video = true
		
		var mediaType = {audio:false,video:false};
		
		for (var j = 0;; j++) {
			// Inspect the "m" field of the SDP
			try {
				var m = sdp[j].m;
				if (m.search("audio") != -1) {
					mediaType.audio = true;
				} else if (m.search("video") != -1) {
					mediaType.video = true;
				}
			} catch(error) {
				// Done
				break;
			}
		}
		
		return mediaType;
	}
	
	/**
	Get the number from a Tel or Sip uri
	@private
	*/
	function _GetNumber(uri) {
		if (uri.indexOf("tel:+") == 0) {
			// Tel uri
			return uri.substring(5, uri.length);
		} else if (uri.indexOf("sip:") == 0) {
			// Sip uri
			return uri.substring(4, uri.indexOf("@"));
		} else {
			return "";
		}
	}
	
	/**
	Create an HTTP request
	@private
	@return {XMLHttpRequest} xmlhttp An XML/HTTP request
	*/
	function _CreateXmlHttpReq(token) {
		var xmlhttp = null;

		if (window.XMLHttpRequest) {
			xmlhttp = new XMLHttpRequest();
		} else if (window.ActiveXObject) {
			// Users with ActiveX off
			try {
				xmlhttp = new ActiveXObject("Microsoft.XMLHTTP");
			} catch (error) {
				// Do nothing
			}
		}

		if (token) {
			xmlhttp.o = xmlhttp.open;
			xmlhttp.open = function(a, b, c)
			{
				this.o(a,b + "?access_token=" + token,c);
				//this.setRequestHeader('Authorization', 'Bearer ' + token);
			};
		}
		xmlhttp.withCredentials = true;

		return xmlhttp;
	}
	
	/**
	The event channel
	@private
	@param {MediaServices} The MediaServices object
	*/
	function _Channel(mediaService) {
		var timer = 2000,
			channel = this,
			_ms = mediaService;
		
		// Poll the channel
		this.pollChannel = function() {
			var channelURL = _ms._gwUrl + CHANNEL_RESOURCE;
			
			logger.log("Querying channel...");
			
			// Create and send a channel query request
			var req = new _CreateXmlHttpReq();
			
			req.open("GET", channelURL, true);
			req.setRequestHeader('Accept', 'application/json, text/html');
			req.setRequestHeader('Cache-Control', 'no-cache');
			req.setRequestHeader('Pragma', 'no-cache');
			req.send(null);
			
			// On response
			req.onreadystatechange = function() {
				if (this.readyState == 4) {
					// Success response 200 OK
					if (this.status == 200) {
						logger.log("Get channel successful: " + this.status + " " + this.statusText + " " + this.responseText);
					
						var json = JSON.parse(this.responseText);
						
						// Parse channel events
						for (var i = 0;; i++) {
							var eventObject = null;
							
							// Get the event
							try {
								eventObject = json.events.list[i].eventObject;
							} catch (error) {
								// No more events in the list, get out
								break;
							}
							
							var type = eventObject["@type"],
								state = eventObject.state,
								from = eventObject.from;
							
							// Channel Handlers
							if (type == "audiovideo" || type == "media-conference") {
								var sdp = eventObject.sdp,
									resourceURL = eventObject.resourceURL;
								
								// Tokenize the resourceURL
								var tokens = resourceURL.split("/");

								if (state.toLowerCase() == "session-open" || state.toLowerCase() == "session-modified" ) {
									// Audio video call session established
									var mediaConfIndex = tokens.indexOf("mediaconf");
									var audioVideoIndex = tokens.indexOf("audiovideo");
									var currentCall;
									
									if (mediaConfIndex != -1) {
										_ms._call.confID = tokens[mediaConfIndex + 1];
										currentCall= _ms._call;
									} else if (audioVideoIndex != -1) {
										var callId= tokens[audioVideoIndex + 1];
										if(_ms._call._callID == null || _ms._call._callID == callId)	{
											currentCall= _ms._call;
										} 
										else if(_ms._transferTargetCall != null && _ms._transferTargetCall._callID == callId){
											currentCall= _ms._transferTargetCall;
										} else {
											console.log("What to do with call id: " + callId + " ?? ");
										}
										currentCall._callID = callId;
									}

									// DEPRECATED: to remove this if case
									try {	
										if (typeof(currentCall._pc) == "webkitDeprecatedPeerConnection") {
										//if (currentCall._pc instanceof webkitDeprecatedPeerConnection) { //throws exception
											var modIndex = tokens.indexOf("mod");
											if (modIndex != -1) {
												currentCall._modID = tokens[modIndex + 1];
												
												if (currentCall._isModerator) {
													// Nothing
												} else {
													var roapMessage = currentCall._DEPRECATEDroap.processRoapAnswer(_ms, sdp);
													currentCall._pc.processSignalingMessage(roapMessage);
												}
											} else {
												if (currentCall._isModerator || (currentCall instanceof Conference && !currentCall._isModerator)) {
													var roapMessage = currentCall._DEPRECATEDroap.processRoapAnswer(_ms, sdp);
													currentCall._pc.processSignalingMessage(roapMessage);
												} else {
													var roapMessage = currentCall._DEPRECATEDroap.processRoapOK(_ms);
													currentCall._pc.processSignalingMessage(roapMessage);
												}
											}
										} else {
											if (currentCall._isModerator || (currentCall instanceof Conference && !currentCall._isModerator)) {
												var remoteSdp= _SDPToString(eventObject.sdpSessionOrigin, sdp);
											    if (currentCall.isRTCConnection) {
													var remoteDest= {};
													remoteDest.type= 'answer';
													remoteDest.sdp= remoteSdp;
													currentCall._pc.setRemoteDescription(new RTCSessionDescription(remoteDest),
														function(){ console.log("remoteSuccess()");	},
														function(err){ console.log("Err setRemoteDescription " + err);});
												} else {
													var sd = new SessionDescription(remoteSdp);
													
													// Get Ice candidates
													var candidates = _GetCandidates(sd.toSdp());
													currentCall._candidates = candidates;
													
													// Receive ANSWER SDP of callee
													currentCall._pc.setRemoteDescription(currentCall._pc.SDP_ANSWER, sd);
													
													// Process the Ice Candidates
													for (index in candidates) {
														var candidate= new IceCandidate(candidates[index].label, candidates[index].candidate);
														currentCall._pc.processIceMessage(candidate);
													}
												}
											}
										}
									} catch (e) {
										if (currentCall.isMozillaConn) {
											var remoteDest= {};
											remoteDest.type= 'answer';
											
											if (currentCall.isBreakout) {
												//remoteDest.sdp= _MozSDPToString(eventObject.sdpSessionOrigin, sdp);
												
												//remoteDest.sdp= _SDPToString(eventObject.sdpSessionOrigin, sdp);
												var tmpsdp = _SDPToString(eventObject.sdpSessionOrigin, sdp);
												//console.log("sdp before tweak:"+tmpsdp);
												var audioIndex=tmpsdp.indexOf("m=audio ");
												//console.log("audioIndex:"+audioIndex);
												var appIndex = tmpsdp.indexOf('m=application');
												//console.log("appIndex:"+appIndex);
												
												
												var sess_sdp_part = tmpsdp.substring(0, audioIndex);
												//console.log("sess_sdp_part:"+sess_sdp_part);
												//console.log("sess_sdp_part length:"+sess_sdp_part.length);
												
												sess_sdp_part = sess_sdp_part + 'a=ice-pwd:myreallysecretpassword' + '\r\n';
												sess_sdp_part = sess_sdp_part + 'a=ice-ufrag:root' + '\r\n';
												sess_sdp_part = sess_sdp_part + 'a=fingerprint:sha-256 80:AD:40:8E:D4:CC:5C:72:A4:1C:7F:BD:31:FC:6C:C2:4B:E3:C1:10:0C:85:C4:E2:50:E8:82:61:69:76:01:89' + '\r\n';
												//console.log("sess_sdp_part:"+sess_sdp_part);
												//console.log("sess_sdp_part length:"+sess_sdp_part.length);
												
												
												//console.log("length:"+tmpsdp.length);
												
												var audio_sdp_part = tmpsdp.substring(audioIndex, appIndex);
												//console.log("audio section:"+audio_sdp_part);
												//console.log("audio length:"+audio_sdp_part.length);
												
												audio_sdp_part = audio_sdp_part.replace(/^.*ice-pwd.*$\r\n/mg, "");
												audio_sdp_part = audio_sdp_part.replace(/^.*ice-ufrag.*$\r\n/mg, "");
												audio_sdp_part = audio_sdp_part.replace(/RTP\/AVP/g, "RTP/SAVPF");
												//console.log("audio section:"+audio_sdp_part);
												//console.log("audio length:"+audio_sdp_part.length);											
												
												
												var app_sdp_part = tmpsdp.substring(appIndex);
												//console.log("app section:"+app_sdp_part);
												//console.log("app length:"+app_sdp_part.length);												
												app_sdp_part = app_sdp_part.replace(/^.*ice-pwd.*$\r\n/mg, "");
												app_sdp_part = app_sdp_part.replace(/^.*ice-ufrag.*$\r\n/mg, "");
												app_sdp_part = app_sdp_part.replace(/m=application .* SCTP/g,"m=application 0 SCTP");
												
												//console.log("app section:"+app_sdp_part);
												//console.log("app length:"+app_sdp_part.length);												
												
												var mod_sdp = sess_sdp_part + audio_sdp_part + app_sdp_part;
												console.log("sdp after tweak:"+mod_sdp);
												remoteDest.sdp = mod_sdp;											
											} else {
												remoteDest.sdp= _MozSDPToString(eventObject.sdpSessionOrigin, sdp);
											}
											



											logger.log("mozilla answer sdp:"+remoteDest.sdp);
											// Receive ANSWER SDP of callee
											currentCall._pc.setRemoteDescription(remoteDest,
														function(){ console.log("remoteSuccess()");	},
														function(err){ 
															console.log("Err setRemoteDescription: " + err);
															});
											
											console.log("after setRemoteDescription");
											
											
											// TODO check if needed to process ice candidates like below
										} else if (currentCall._isModerator || (currentCall instanceof Conference && !currentCall._isModerator)) {
											var sd = new SessionDescription(_SDPToString(eventObject.sdpSessionOrigin, sdp));
											
											// Get Ice candidates
											var candidates = _GetCandidates(sd.toSdp());
											currentCall._candidates = candidates;
											
											// Receive ANSWER SDP of callee
											currentCall._pc.setRemoteDescription(currentCall._pc.SDP_ANSWER, sd);
											
											// Process the Ice Candidates
											for (index in candidates) {
												var candidate= new IceCandidate(candidates[index].label, candidates[index].candidate);
												currentCall._pc.processIceMessage(candidate);
											}
										}
									}
								} else if (state.toLowerCase() == "session-terminated") {
									// Audio video call terminated
									if (_ms._call) {
										if (_ms._call.state != Call.State.ENDED) {
										// Cleanup the Peer Connection
											if (_ms._call._pc && _ms._call._pc.close) {
												if(_ms._call.localStreams[0] && _ms._call.localStreams[0].stop){
													_ms._call.localStreams[0].stop();
												}
												if(_ms._call.remoteStreams[0] && _ms._call.remoteStreams[0].stop){
													_ms._call.remoteStreams[0].stop();
												}
												_ms._call._pc.close();
												_ms._call._pc = null;
											}
										
											// Clear moderator flag
											_ms._call._isModerator = null;
											_ms._call._callID = null;

											_ms._call.state = Call.State.ENDED;
											if (typeof(_ms._call.onend) == "function") { 
												var endingReason= (typeof(eventObject.reason) === "undefined")?"Call terminated":eventObject.reason;
												logger.log("session-terminated --> call onend()");
												_ms._call.onend({reason: endingReason}); 
											}
										}
									}
								} else if (state.toLowerCase() == "invitation-received") {
									// Receive audio video call invitation
									var index = tokens.indexOf("audiovideo");
									var mediaType = _ParseSDPMedia(sdp);
									
									// Set the media type of the call invitation
									mediaType = _ParseMediaType(_ms, mediaType);
									
									// Create a new IncomingCall object and save the remote SDP
									_ms._call = new IncomingCall(_ms, from, mediaType);
									_ms._call._isModerator= false;
									_ms._call.mediaType= mediaType;
									_ms._call._url = _ms._host + eventObject.resourceURL.substr(eventObject.resourceURL.indexOf("HaikuServlet"));
									_ms._call._callID = tokens[index + 1];
									
									// Parse the SDP
									_ms._call._sdp.type = "ANSWER";
									_ms._call._sdp.sdp = _MozSDPToString(eventObject.sdpSessionOrigin, sdp);
									logger.log(_ms._call._sdp.sdp);
									
									// DEPRECATED: to remove
									_ms._call._DEPRECATEDsdp = sdp;
									
									// Grab the Ice candidates
									_ms._call._candidates = _GetCandidates(_ms._call._sdp.sdp);
									
									_ms._call.state = Call.State.RINGING;
								} else if (state.toLowerCase() == "mod-terminated") {
									var index = tokens.indexOf("mod");									
									logger.log("Terminating modification: " + tokens[index + 1]);	
									currentCall= _ms._call;
									currentCall._modID = null;
									var remoteSdp= _SDPToString(eventObject.sdpSessionOrigin, sdp);
									if (currentCall.isRTCConnection && currentCall._isModifModerator) {
										var remoteDest= {};
										remoteDest.type= 'answer';
										remoteDest.sdp= remoteSdp;
										currentCall._pc.setRemoteDescription(new RTCSessionDescription(remoteDest),
											function(){ console.log("Modification Success()");	},
											function(err){ console.log("Err setRemoteDescription " + err);});
									}
									currentCall._isModifModerator=null;
								} else if (state.toLowerCase() == "mod-received") {
									// DEPRECATED: to remove (Reinvite received)
									var index = tokens.indexOf("mod");									
									_ms._call._modID = tokens[index + 1];
									logger.log("Processing modification: " + _ms._call._modID);
									logger.log("New SDP offer is: " + _ms._call._modID);
									_ms._call._isModifModerator= false;
									_ms._call._sdp.type = "ANSWER";
									_ms._call._sdp.sdp = _SDPToString(eventObject.sdpSessionOrigin, sdp);

									_ms._call._doAnswer();
									//if (_ms._isModerator || (_ms._call instanceof Conference && !_ms._isModerator)) {
									//	var roapMessage = _ms._call._DEPRECATEDroap.processRoapOffer(_ms, sdp);
									//	_ms._call._pc.processSignalingMessage(roapMessage);
									//}
								} else if (state.toLowerCase() == "transfer-initiated") {
									console.log("transfer-initiated");
								} else if (state.toLowerCase() == "transfer-terminated") {
									console.log("transfer-terminated");
									var index = tokens.indexOf("mod");								
									_ms._call._modID = tokens[index + 1];
									_ms._call.end();
									_ms._transferTargetCall.end();
								} else {
									// Unhandled event
									logger.log("Unhandled audio video channel event: " + type + " " + state);
								}
							} else if (type == "file-transfer") {
								var fileName = eventObject.fileName,
									fileSize = eventObject.fileSize,
									contentType = eventObject.contentType,
									ftId = eventObject.ftId;
							
								// Get the current file transfer object in the hashmap
								var ft = null;
								if (_ms._ftp) {
									ft = _ms._ftp.get(ftId);
								}
								
								if (state.toLowerCase() == "session-open" && ft) {
									if (ft instanceof OutgoingFileTransfer) {
										logger.log("Uploading...");
										
										// Automatically start uploading
										ft._id = ftId;
										ft._uploadFile();
									} else {
										logger.log("Downloading...");
										
										// Automatically start downloading
										ft._downloadFile();
									}
								} else if (state.toLowerCase() == "session-terminated" && ft) {
									var code = eventObject.code;
									
									// File transfer session terminated
									logger.log("session-terminated");
									
									if (ft.state != FileTransfer.State.ERROR &&
											ft.state != FileTransfer.State.CANCELED) {
										// If not in an error state, check what error code we've received
										switch (code) {
											case 487:
											case 603:
												ft.state = FileTransfer.State.CANCELED;
												break;
											case 403:
												_InternalError(ft, FileTransfer.Error.FILE_SIZE_LIMIT);
												break;
											case 486:
												_InternalError(ft, FileTransfer.Error.TIMEOUT);
												break;
											case 480:
											case 500:
												_InternalError(ft, FileTransfer.Error.INVALID_USER);
												break;
											default:
												break;
										}
									}
								} else if (state.toLowerCase() == "invitation-received") {
									// File transfer invitation received
									if (ft) {
										// Already had an old file transfer session from same user, remove it
										_ms._ftp.remove(ftId);
									} else {
										ft = new IncomingFileTransfer(_ms, from);
										ft._url = _ms._gwUrl + FILETRANSFER_RESOURCE;
										ft._id = ftId;
										ft._fileName = fileName;
										ft._fileSize = fileSize;
										ft._fileType = contentType;
										
										ft.state = FileTransfer.State.INVITATION_RECEIVED;
										
										// Put the new object in the hashmap
										_ms._ftp.put(ftId, ft);
									}
								}
							} else if (type == "address-book") {
								// An address book update
								var contacts = eventObject.contacts;
								//var abId = eventObject.abId; // TODO: unused ????
								
								_ms._contactList._syncId = eventObject.syncId;
								
								if (contacts) {
									_ms._contactList._parseAddressBook(contacts);
								}
							} else if (type == "message") {
								var	body = eventObject.body,
									//contentType = eventObject.contentType,
									typeMessage = eventObject.type;
									var msg = {
										from: from,
										message: body
									};
										
								
								if (typeMessage == "session-message") {
									// Check if it's a new chat session with another user
									if (_ms._chat.contains(from) == -1) {
										var newChat = new Chat(_ms, from);
										newChat._url = _ms._gwUrl + CHAT_RESOURCE;
										newChat.state = Chat.State.ACTIVE;
										
										var evt = {
											chat: newChat,
											call: null,										
											conf: null
										};
									
										_ms.oninvite(evt);
										
										newChat.onmessage(msg);
										_ms._chat.put(from, newChat);
									} else {
										// Chat already exists
										var ongoingChat = _ms._chat.get(from);
										
										if (ongoingChat.state != Chat.State.ACTIVE) {
											ongoingChat.state = Chat.State.ACTIVE;
										}

										ongoingChat.onmessage(msg); 
									}
								} else if (typeMessage == "message") {
									logger.log("PAGER MODE MESSAGE");										
									_ms.oninstantmessage(msg);
								}
							} else if (type == "composing") {
								var refresh = eventObject.refresh;
							
								var ongoingChat = _ms._chat.get(from);
								
								var evt = {
									from : from,
									state : state,
									refresh : refresh
								};
								
								ongoingChat.oncomposing(evt); 
							} else if (type == "media-message") {
								// Received a media-message
								var from = eventObject.from,
									//contentType = eventObject.contentType,
									//size  = eventObject.size,
									url = eventObject.url;
							
								var ongoingChat = _ms._chat.get(from);
								ongoingChat.state = Chat.State.ACTIVE;
								
								// Get the file ID from url
								var id = url.substring(url.indexOf("fileRef") + 8, url.length);
								
								// Get the file automatically
								ongoingChat._getMedia(id, from);
							} else if (type == "message-failure") {
								var to = eventObject.to,
									//msgId = eventObject.msgId,
									code = eventObject.code;
								
								var ongoingChat = _ms._chat.get(to);
								
								switch (code) {
									case 480:
										_InternalError(ongoingChat, Chat.Error.USER_NOT_ONLINE);
										break;
									case 500:
										_InternalError(ongoingChat, Chat.Error.INVALID_USER);
										break;
									case 404:
									default:
										_InternalError(ongoingChat, Chat.Error.NETWORK_FAILURE);
										break;
								}
							} else if (type == "conference-invite"){
								// Group chat invitation
								var referredBy = eventObject.referredBy,
									confId = eventObject.confId,
									subject = eventObject.subject,
									members = eventObject.members;
								
								var newGroupChat = new GroupChat(_ms, subject, members, referredBy, confId);
								newGroupChat._url = _ms._gwUrl + GROUP_CHAT_RESOURCE;
								
								var evt = {
									groupChat: newGroupChat,
									chat: null,								
									call: null,
									conf: null
								};
							
								_ms.oninvite(evt);
							} else if (type == "conference-info") {
								// Group chat updated info (users and states)
								var userCount = eventObject.userCount,
									confId = eventObject.confId,
									//state = eventObject.state,
									//reason = eventObject.reason,
									users = eventObject.users;
								
								var ongoingGroupChat = _ms._chat.get(confId);
								
								if (ongoingGroupChat) {
									if (userCount == 0 || users.length == 0) {
										// Users declined group chat invite
										ongoingGroupChat.state = GroupChat.State.ENDED;
									} else {
										if (ongoingGroupChat.state != GroupChat.State.ENDED) {
											// The group chat is ongoing
											if (ongoingGroupChat.state != GroupChat.State.IN_PROGRESS) {
												ongoingGroupChat.state = GroupChat.State.IN_PROGRESS;
											}
											
											// Handle the members' statuses
											for (var j = 0; j < users.length; j++) {
												var l = 0;
												for (; l < ongoingGroupChat.members.length; l++) {
													// Received a disconnected event of self
													if (_ms.username == users[j].entity && users[j].status == "disconnected") {
														ongoingGroupChat.state = GroupChat.State.ENDED;
													}
													
													if (ongoingGroupChat.members[l].entity == users[j].entity) {
														ongoingGroupChat.members[l].status = users[j].status;
														break;
													}
												}
												
												// New user
												if (l == ongoingGroupChat.members.length) {
													ongoingGroupChat.members.push(users[j]);
												}
											}
											
											if (ongoingGroupChat.state != GroupChat.State.ENDED) {
												ongoingGroupChat.onupdate({ members : ongoingGroupChat.members });
											}
										} else {
											// The group chat has already ended
										}
									}
								}
							} else if (type == "conference-message") {
								// Group chat message received
								var from = eventObject.from,
									confId = eventObject.confId,
									body = eventObject.body;
									
								logger.log("GroupChat message: confId: " + confId + ", from: " + from + ", body: " + body);
								
								var ongoingGroupChat = _ms._chat.get(confId);
								
								var evt = {
									confId: confId,
									from: from,
									message: body
								};
								
								ongoingGroupChat.onmessage(evt);
							} else if (type == "conference-media-message") {
								// Group chat media message received
								var from = eventObject.from,
									confId = eventObject.confId,
									//contentType = eventObject.contentType,
									//size = eventObject.size,
									url = eventObject.url;
								
								var ongoingGroupChat = _ms._chat.get(confId);
								
								// Get the file ID from url
								var id = url.substring(url.indexOf("fileRef") + 8, url.length);
								
								// Get the file automatically
								ongoingGroupChat._getMedia(id,from);
							} else if (type == "conference-composing") {
								// Group chat is composing received
								var from = eventObject.from,
									confId = eventObject.confId,
									refresh = eventObject.refresh,
									state = eventObject.state;
									
								var ongoingGroupChat = _ms._chat.get(confId);
								
								var evt = {
									from: from,
									refresh : refresh,
									state : state
								};
								
								ongoingGroupChat.oncomposing(evt); 	
							} else if (type == "contactlist") {
								// List of users with a presence relationship
								var contacts = eventObject.contacts;
								
								if (contacts) {
									// Update our contact list
									_ms._contactList._parseContactList(contacts);
								}
							} else if (type == "presencelist") {
								// Presence information
								var userPresences = eventObject.userPresences;
								
								if (userPresences) {
									_ms._contactList._parsePresenceList(userPresences);
								}
							} else if (type == "anonymous-subscription") {
								// Event containing individual user with services/isIMSUser
								//var isIMSUser = eventObject.isIMSUser;
								//var services = eventObject.services;
								
								// TODO: implement if we need anonymous subscribe
							} else if (type == "watcherlist") {
								// List of Presence follow requests
								var contacts = eventObject.contacts;
								
								if (contacts) {
									// An array of Contacts with presence request
									var array = [];
									
									for (var j in contacts) {
										var uri = contacts[j].uri;
										var found = false;
										
										// Find that Contact in ContactList
										for (var l in _ms._contactList.contact) {
											if (_GetNumber(uri) == _ms._contactList.contact[l]._id) {
												array.push(_ms._contactList.contact[l]);
												found = true;
											}
										}
										
										// User not found, create a new contact
										if (found == false) {
											var info = {
												numbers : [{
													number : contacts[j].uri
												}]
											};
											
											var contact = new Contact(info);
											contact._mediaServices = _ms;
											contact._url = _ms._gwUrl;
											contact._id = _GetNumber(contacts[j].uri);
											array.push(contact);
										}
									}
									
									// Presence invite callback
									var evt = { contacts : array };
									_ms._contactList.onpresenceinvite(evt);
								}
							} else {
								// Unhandled event
								state = eventObject.state;
								logger.log("Unhandled channel event: " + type + " " + state);
							}
						}
						
						// Poll again
						if (_ms._channel != null) {
							timer = 2000;
							setTimeout(function(){channel.pollChannel();},5);
						}
					}
					// Success response 204 No Content
					else if (this.status == 204) {
						logger.log("Get channel successful: " + this.status + " " + this.statusText + " " + this.responseText);
						
						// Poll again
						if (_ms._channel != null) {
							timer = 2000;
							setTimeout(function(){channel.pollChannel();},5);
						}
					}
					// Error response
					else {
						if (timer >= 128000) {
							// Try to logout since channel hasn't responded for 4 minutes
							_ms.unregister();
						} else {
							// If we are unable to poll the channel, attempt to poll for 2 minutes exponentially, then stop
							if (_ms._channel != null) {
								timer *= 2;
								logger.log("Get channel unsuccessful: " + this.responseText);
								setTimeout(function(){channel.pollChannel();},timer);
							}
						}
					}
				}
			};
		};
	}
	
	/**
	Build WCG signaling SDP object from SDP string
	@private
	@param {String} recipient The recipient of the call
	@param {String} Offer SDP
	@return {Object} The SDP in accepted WCG json format
	*/
	
	// _try2
	function _MozParseSDP(recipient, sdp) {
		var SDP = {};
		
		if (recipient) {
			SDP = {
				to : recipient,
				sdp : []
			};
		} else {
			SDP = {
				sdp : []
			};
		}
		
		var sdp_string = JSON.stringify(sdp);		
		var mediaIndex= sdp_string.indexOf("m=");
		var commonPart= sdp_string.substring(1, mediaIndex);		
		var mediaPart= sdp_string.substring(mediaIndex);

		// WCG REST interface cannot carry the session-level section information
		// faked media section is used as workaround to store session-level information
		var sessionlevel_struct = {
			m : "application 4711 udp session",  // FAKE media section to package the session section
			// v : "",
			// o : "",
			// s : "",
			// t : "",
			attributes : []
		};
		
		var lines_array = commonPart.split("\\r\\n");
		for(var i in lines_array) {
			var line = lines_array[i];
			
			if (line[0] == "v" || line[0] == "o"  || line[0] == "s"  || line[0] == "t") {
				var faked_attribute = { a : line[0]+":"+line.substring(2) };
				sessionlevel_struct.attributes.push(faked_attribute);
			}
			
			if (line[0] == "a") { 
				var a_line = { a : line.substring(2) };					
				sessionlevel_struct.attributes.push(a_line);
			}
		}		

		// store faked media section
		SDP.sdp.push(sessionlevel_struct);

		var media_line_array = mediaPart.split("m=");
		for (var index in media_line_array) {
			if(media_line_array[index] === "") continue;
			var m = "m=" + media_line_array[index];
			var lines_array = m.split("\\r\\n");
			lines_array.pop();
			
			// For each media, split all the lines
			// Find the m, the c, and the a
			var m_struct = {};
			m_struct = {
				m : "",
				c : "",
				attributes : []
			};
			
			for(var i in lines_array) {
				var line = lines_array[i];
				
				if (line[0] == "m") {
					m_struct.m = line.substring(2);
				}
				
				if (line[0] == "c") {
					m_struct.c = line.substring(2);
				}
				
				if (line[0] == "a") { 
					var a_line = { a : line.substring(2) };					
					m_struct.attributes.push(a_line);
				}
			}	
			
			SDP.sdp.push(m_struct);
		}
		
		logger.log(JSON.stringify(SDP,null, " "));		

		return SDP;
	}
	
	
	function _ParseSDP(recipient, sdp) {
		var SDP = {};		
		if (recipient) {
			SDP = {
				to : recipient,
				sdp : []
			};
		} else {
			SDP = {
				sdp : []
			};
		}
		
		var sdp_string = JSON.stringify(sdp);		
		var mediaIndex= sdp_string.indexOf("m=");
		var commonPart= sdp_string.substring(0, mediaIndex);		
		var mediaPart= sdp_string.substring(mediaIndex);

		// Get the v line
		var v_pattern = /v=(.*?)(?=\\r\\n)/g;
		var v_match = v_pattern.exec(commonPart);

		// Get the o line
		var o_pattern = /o=(.*?)(?=\\r\\n)/g;
		var o_match = o_pattern.exec(commonPart);

		// Get the s line
		var s_pattern = /s=(.*?)(?=\\r\\n)/g;
		var s_match = s_pattern.exec(commonPart);

		// Get the t line
		var t_pattern = /t=(.*?)(?=\\r\\n)/g;
		var t_match = t_pattern.exec(commonPart);

		// Get the a line
		//TODO - WCG does not support multiple attributes.. Will be fix in next release
		var a_pattern = /a=(.*?)(?=\\r\\n)/g;
		var a_match = a_pattern.exec(commonPart);

		// Split all media
		var media_line_array = mediaPart.split("m=");
		
		var doCommonPart= true;
		for (var index in media_line_array) {
			if(media_line_array[index] === "") continue;
			var m = "m=" + media_line_array[index];
			var lines_array = m.split("\\r\\n");
			lines_array.pop();
			
			// For each media, split all the lines
			// Find the m, the c, and the a
			var m_struct = {};
			if (doCommonPart) {
				doCommonPart= false;
				if(a_match == null){
					m_struct = {
						v : v_match[1],
						o : o_match[1],
						s : s_match[1],
						t : t_match[1],
						m : "",
						c : "",
						attributes : []
					};
				} else {
					m_struct = {
						v : v_match[1],
						o : o_match[1],
						s : s_match[1],
						t : t_match[1],
						a : a_match[1],
						m : "",
						c : "",
						attributes : []
					};
				}
			} else {
				m_struct = {
					m : "",
					c : "",
					attributes : []
				};
			}
			
			for(var i in lines_array) {
				var line = lines_array[i];
				
				if (line[0] == "m") {
					m_struct.m = line.substring(2);
				}
				
				if (line[0] == "c") {
					m_struct.c = line.substring(2);
				}
				
				if (line[0] == "a") { 
					var a_line = { a : line.substring(2) };					
					m_struct.attributes.push(a_line);
				}
			}	
			
			SDP.sdp.push(m_struct);
		}
		
		logger.log(JSON.stringify(SDP,null, " "));		

		return SDP;
	}
	
	
	/**
	Build SDP string from SDP object
	@private
	@param {Object} sdp WCG json SDP
	@returns {String} SDP as string
	*/
	function _MozSDPToString(origin, sdp) {
		// TODO: WCG should return v= o= s= t= a= lines, parse them
		// Hardcode this for now
				
		var sdp_str="";
		
		
		// Ok, seems like wcg server sorts the attributes in ascii order
		// this is not good for 'v' 'o' 's' 't'
		// lets do separate handling for index 0 and ignore index 0 in the foor loop
		var v_attr_str=null;
		var o_attr_str;
		var s_attr_str;
		var t_attr_str;
		var session_attribues_str="";
		
		if (sdp[0].m == "application 4711 udp session") {				
			for(attributeIndex in sdp[0].attributes) {
				var value = sdp[0].attributes[attributeIndex].a;
				var prefix = value.substring(0,2);
				// check for faked session level v-o-s-t attributes 
				//"o:Mozilla-SIPUA 27684 0 IN IP4 0.0.0.0"
				if (prefix == "v:" ) {
					v_attr_str = "v=" + value.substring(2) + "\r\n";
				} else if ( prefix == "s:") {
					s_attr_str = "s=" + value.substring(2) + "\r\n";
				} else if ( prefix == "t:") {
					t_attr_str = "t=" + value.substring(2) + "\r\n";
				} else if ( prefix == "o:") {
					// this origin override probably should work
					// But for the Mozilla case we want the original value in the offer
					// if(typeof(origin) === "undefined") {
						// sdp_str += prefix + value.substring(2);					
					// } else {
						// sdp_str+= origin + "\r\n";
					// }
					o_attr_str = "o=" + value.substring(2) + "\r\n";
				} else {
					session_attribues_str += "a=" + sdp[0].attributes[attributeIndex].a + "\r\n";
				}
			}				
		}
		
		if (!v_attr_str) {
			throw new Error("Abort: The sdp does not seem to contain the fake application section needed for wcg workaround");
		}
		
		sdp_str += v_attr_str;
		sdp_str += o_attr_str;
		sdp_str += s_attr_str;
		sdp_str += t_attr_str;
		sdp_str += session_attribues_str;
		
				
		
		
		
		for (var mediaIndex in sdp) {
			// WCG REST interface cannot carry the session-level section information
			// lets look for faked media section (workaround to stores session-level information)
			if (sdp[mediaIndex].m == "application 4711 udp session") {
				
				console.log("ignore index 0 (it is already processed)");
				
			} else {
				sdp_str += "m=" + sdp[mediaIndex].m + "\r\n";
				sdp_str += "c=" + sdp[mediaIndex].c + "\r\n";
				for(attributeIndex in sdp[mediaIndex].attributes) {
					sdp_str += "a=" + sdp[mediaIndex].attributes[attributeIndex].a + "\r\n";
				}
			}
		}
		
		return sdp_str;
	}
	

	
	function _SDPToString(origin, sdp) {
		// TODO: WCG should return v= o= s= t= a= lines, parse them
		// Hardcode this for now
				
		var roapsdp;
		if(typeof(origin) === "undefined") {		
			roapsdp = "v=0\r\no=- 0 0 IN IP4 127.0.0.1\r\ns=\r\nt=0 0\r\n";
		} else {
			roapsdp = "v=0\r\n" + origin + "\r\ns=\r\nt=0 0\r\n";
		}

		for (mediaIndex in sdp) {
			roapsdp += "m=" + sdp[mediaIndex].m + "\r\n";
			roapsdp += "c=" + sdp[mediaIndex].c + "\r\n";
			for(attributeIndex in sdp[mediaIndex].attributes) {
				roapsdp += "a=" + sdp[mediaIndex].attributes[attributeIndex].a + "\r\n";
			}
		}
		
		return roapsdp;
	}
	
	/**
	Retrieve candidates from sdp
	@private
	@param {String} sdp SDP as string
	@returns {Array} Array of Ice candidates
	*/
	function _GetCandidates(sdp) {
		var candidates = [];
		
		var lines = sdp.split("\r\n");
		var labelIndex = -1;
		
		for (i in lines) {
			if (lines[i].indexOf("m=") == 0) {
				labelIndex++;
			} else if (lines[i].indexOf("a=candidate") == 0) {
				candidates.push({label: labelIndex, candidate: lines[i]});
			}
		}
		
		return candidates;
	}

	/**
	ROAP message handling object
	@deprecated Not used for JSEP. To remove when ROAP is no longer supported.
	@private
	*/
	function _DEPRECATEDRoap() {
		// WCG roap object 
		var _H2SRoap = {
			messageType : "",
			SDP : [],
			offererSessionId : "" ,
			answererSessionId : "",
			
			reset : function() {
				messageType = "",
				SDP = [],
				offererSessionId = "" ,
				answererSessionId = "";
			}
		};
		
		// Parse a ROAP message and return an SDP
		this.parseROAP = function(message) {
			var json = JSON.parse(message.slice(message.indexOf("{")), message.lastIndexOf("}"));
			_H2SRoap.reset();
			
			_H2SRoap.messageType = json.messageType;
			_H2SRoap.offererSessionId = json.offererSessionId;
			_H2SRoap.answererSessionId = json.answererSessionId;
			_H2SRoap.SDP = null;
				
			if (json.sdp) {
				var SDP = {
					v : "",
					o : "",
					s : "",
					t : "",
					sdp : []
				};
			
				var sdp_string = JSON.stringify(json.sdp);
				// Get the v line
				var v_pattern = /v=(.*?)(?=\\r\\n)/g;
				var v_match = v_pattern.exec(sdp_string);
				SDP.v = v_match[1];

				// Get the o line
				var o_pattern = /o=(.*?)(?=\\r\\n)/g;
				var o_match = o_pattern.exec(sdp_string);
				SDP.o = o_match[1];

				// Get the s line
				var s_pattern = /s=(.*?)(?=\\r\\n)/g;
				var s_match = s_pattern.exec(sdp_string);
				SDP.s = s_match[1];

				// Get the t line
				var t_pattern = /t=(.*?)(?=\\r\\n)/g;
				var t_match = t_pattern.exec(sdp_string);
				SDP.t = t_match[1];

				// Get all media
				var media_pattern = /m=(.*)/g;
				var media_match = media_pattern.exec(sdp_string);
				var media = media_match[1];

				// Split all media
				var media_line_array = media.split("m=");
				
				for (var index in media_line_array) {
					var m = "m=" + media_line_array[index];
					var lines_array = m.split("\\r\\n");
					lines_array.pop();
					
					// For each media, split all the lines
					// Find the m, the c, and the a
					var m_struct = {
						m : "",
						c : "",
						attributes : []
					};
					
					for(var i in lines_array) {
						var line = lines_array[i];
						
						if (line[0] == "m") {
							m_struct.m = line.substring(2);
						}
						
						if (line[0] == "c") {
							m_struct.c = line.substring(2);
						}
						if (line[0] == "a") { 
							var a_line = { a : line.substring(2) };
							m_struct.attributes.push(a_line);
						}
						
					}
					
					SDP.sdp.push(m_struct);
				}
				
				_H2SRoap.SDP = SDP;
			}
			
			return _H2SRoap;
		};
		
		// Build the OFFER ROAP message and process it
		this.processRoapOffer = function(mediaServices, sdp) {
			logger.log("Processing an OFFER...");
			var offererSessionId = null;
			var answererSessionId = null;
			var seq = 1;
			if (mediaServices._call._isModerator || (mediaServices._call instanceof Conference && !mediaServices._call._isModerator)) {
				seq = 2;
				offererSessionId = _H2SRoap.offererSessionId;
				answererSessionId = _H2SRoap.answererSessionId;
			} else {
				offererSessionId = this.idGenerator();
				seq = 1;
			}
			var tieBreaker = this.tieBreakerGenerator();

			//build the sdp

			//build the ROAP message
			//the sdp has been set on invitation received
			var roapsdp = "v=0\r\no=- 0 0 IN IP4 127.0.0.1\r\ns=\r\nt=0 0\r\n";
			for (mediaIndex in sdp) {
				roapsdp += "m=" + sdp[mediaIndex].m + "\r\n";
				roapsdp += "c=" + sdp[mediaIndex].c + "\r\n";
				for(attributeIndex in sdp[mediaIndex].attributes) {
					roapsdp += "a=" + sdp[mediaIndex].attributes[attributeIndex].a + "\r\n";
				}
			}

			var roapStruct = {
				"messageType" : "OFFER",
				"offererSessionId" : offererSessionId,
				"answererSessionId" : answererSessionId,
				"sdp" : roapsdp,
				"seq" : seq,
				"tieBreaker" : tieBreaker
			};

			var roapMessage = "SDP\n" + JSON.stringify(roapStruct);
			
			return roapMessage;
		};
		
		// Build the ANSWER ROAP message and process it
		this.processRoapAnswer = function(mediaServices, sdp) {
			logger.log("Processing an ANSWER...");
			var offererSessionId = null;
			var answererSessionId = null;
			var seq = 2;

			if (mediaServices._call._isModerator || (mediaServices._call instanceof Conference && !mediaServices._call._isModerator)) {
				seq = 1;
				offererSessionId = _H2SRoap.offererSessionId;
				answererSessionId = this.idGenerator();
			} else {
				seq = 2;
				offererSessionId = _H2SRoap.offererSessionId;
				answererSessionId = _H2SRoap.answererSessionId;
			}

			//build the sdp

			//build the ROAP message
			//the sdp has been set on invitation received
			var roapsdp = "v=0\r\no=- 0 0 IN IP4 127.0.0.1\r\ns=\r\nt=0 0\r\n";
			for(mediaIndex in sdp) {
				roapsdp += "m=" + sdp[mediaIndex].m + "\r\n";
				roapsdp += "c=" + sdp[mediaIndex].c + "\r\n";
				for(attributeIndex in sdp[mediaIndex].attributes) {
					roapsdp += "a=" + sdp[mediaIndex].attributes[attributeIndex].a + "\r\n";
				}
			}

			var roapStruct = {
				"messageType" : "ANSWER",
				"offererSessionId" : offererSessionId,
				"answererSessionId" : answererSessionId,
				"sdp" : roapsdp,
				"seq" : seq
			};

			var roapMessage = "SDP\n" + JSON.stringify(roapStruct);
			
			return roapMessage;
		};
		
		// Build the OK ROAP message and process it
		this.processRoapOK = function(mediaServices) {
			logger.log("Processing an OK...");

			if(!_H2SRoap.answererSessionId) {
				_H2SRoap.answererSessionId = this.idGenerator();
			}
			var offererSessionId = _H2SRoap.answererSessionId;
			var answererSessionId = _H2SRoap.offererSessionId;
			var seq = 1;
			if (mediaServices._call._isModerator) {
				seq = 2;
			} else {
				seq = 1;
			}
			var roapStruct = {
				"messageType" : "OK",
				"offererSessionId" : offererSessionId,
				"answererSessionId" : answererSessionId,
				"seq" : seq
			};

			var roapMessage = "SDP\n" + JSON.stringify(roapStruct);
			logger.log("roap message: " + roapMessage);
			return roapMessage;
		};
		
		// The offererSessionId and the answererSessionId must be of 32 characters
		this.idGenerator = function() {
			var S4 = function() {
				return (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1);
			};
			return (S4() + S4() + S4() + S4() + S4() + S4() + S4() + S4());
		};
		
		// The tieBreaker must be of 10 digits
		this.tieBreakerGenerator = function() {
			var id = Math.floor(Math.random() * 90000) + 1000000000;
			return id;
		};
	}

	/**
	Hashmap implementation
	@private
	*/
	var _HashMap = function() {
		var obj = [];
		obj.size = function () {
			return this.length;
		};
		obj.isEmpty = function () {
			return this.length == 0;
		};
		obj.contains = function (key) {
			for (i in this) {
				if (this[i].key == key) {
					return i;
				}
			}
			return -1;
		};
		obj.get = function (key) {
			var i = this.contains(key);
			if (i !== -1) {
				return this[i].value;
			}
		};
		obj.put = function (key, value) {
			if (this.contains(key) == -1) {
				this.push({'key': key, 'value': value});
				return true;
			}
			return false;
		};
		obj.clear = function () {
			for (i in this) {
				this.pop(i);
			}
		};
		obj.remove = function(key) {
			var i = this.contains(key);
			if (i) {
				this.splice(i,1);
			}
		};
		obj.getAll = function() {
			return this;
		};
		return obj;
	};
})(window);
