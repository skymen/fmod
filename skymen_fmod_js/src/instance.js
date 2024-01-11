function getInstanceJs(parentClass, scriptInterface, addonTriggers, C3) {
  return class extends parentClass {
    constructor(inst, properties) {
      super(inst);

      if (properties) {
      }

      if (!C3.Plugins.skymen_fmod) {
        alert(
          "FMOD_JS: This implementation does nothing on its own. Please install the FMOD plugin."
        );
      }
    }

    SendMessage(id, data) {
      this.PostToDOM(id, data);
    }

    SendMessageAsync(id, data) {
      return this.PostToDOMAsync(id, data);
    }

    HandleMessage(id, callback) {
      this.AddDOMMessageHandler(id, callback);
    }

    HandleMessages(arr) {
      this.AddDOMMessageHandlers(arr);
    }

    SaveToJson() {
      return {
        // data to be saved for savegames
      };
    }

    LoadFromJson(o) {
      // load state for savegames
    }
  };
}
