"use strict";
{
  // Update the DOM_COMPONENT_ID to be unique to your plugin.
  // It must match the value set in instance.js as well.

  //<-- DOM_COMPONENT_ID -->

  // This class handles messages from the runtime, which may be in a Web Worker.
  const HANDLER_CLASS = class extends self.DOMHandler {
    constructor(iRuntime) {
      super(iRuntime, DOM_COMPONENT_ID);
      this.FMOD = {};
      this.FMOD["preRun"] = this.preRun.bind(this);
      this.FMOD["onRuntimeInitialized"] = this.onRuntimeInitialized.bind(this);
      this.FMOD["INITIAL_MEMORY"] = 80 * 1024 * 1024;
      this.gWantSampleLoad = true;
      this.lastSuspendTime = 0;
      this._preRunCallbacks = [];
      this._initCallbacks = [];
      this.banks = [];
      this.events = {};
      this.buses = {};
      this.vcas = {};
      this.banksByName = new Map();
      this.banksByPath = new Map();
      this.SetUpDOMHandlers();
      this.nextTickArray = [];
    }

    // ===== SET UP FUNCTIONS

    SetUpDOMHandlers() {
      this.AddRuntimeMessageHandlers([
        ["pre-init", () => this.PreInit()],
        [
          "pre-init-load-bank",
          ([path, preload, nonBlocking, name, url]) =>
            this.PreInitLoadBank(path, preload, nonBlocking, name, url),
        ],
        [
          "start-one-time-event",
          ([event]) => {
            this.startOneTimeEvent(event);
          },
        ],
        ["update", () => this.update()],
        ["load-bank", ([name]) => this.loadBank(name)],
        ["unload-bank", ([name]) => this.unloadBank(name)],
        ["unload-all-banks", () => this.unloadAllBanks()],
        [
          "instantiate-event",
          ([name, tags]) => this.instantiateEvent(name, tags),
        ],
        [
          "start-event",
          ([name, tag, destroyWhenStopped]) =>
            this.startEvent(name, tag, destroyWhenStopped),
        ],
        [
          "set-event-parameter",
          ([name, tag, param, value, ignoreSeekSpeed]) =>
            this.setEventParameter(name, tag, param, value, ignoreSeekSpeed),
        ],
        [
          "set-event-parameter-with-label",
          ([name, tag, param, value, ignoreSeekSpeed]) =>
            this.setEventParameterWithLabel(
              name,
              tag,
              param,
              value,
              ignoreSeekSpeed
            ),
        ],
        [
          "set-global-parameter",
          ([param, value, ignoreSeekSpeed]) =>
            this.setGlobalParameter(param, value, ignoreSeekSpeed),
        ],
        [
          "set-global-parameter-with-label",
          ([param, value, ignoreSeekSpeed]) =>
            this.setGlobalParameterWithLabel(param, value, ignoreSeekSpeed),
        ],
        [
          "stop-event",
          ([name, tag, allowFadeOut, release]) =>
            this.stopEvent(name, tag, allowFadeOut, release),
        ],
        [
          "stop-all-events",
          ([name, allowFadeOut, release]) =>
            this.stopAllEvents(name, allowFadeOut, release),
        ],
        ["release-event", ([name, tag]) => this.releaseEvent(name, tag)],
        [
          "release-all-event-instances",
          ([name]) => this.releaseAllEventInstances(name),
        ],
        [
          "set-event-paused",
          ([name, tag, paused]) => this.setEventPaused(name, tag, paused),
        ],
        [
          "set-event-3d-attributes",
          ([name, tag, x, y, z, vx, vy, vz, fx, fy, fz, ux, uy, uz]) =>
            this.setEvent3DAttributes(
              name,
              tag,
              x,
              y,
              z,
              vx,
              vy,
              vz,
              fx,
              fy,
              fz,
              ux,
              uy,
              uz
            ),
        ],
        [
          "set-listener-3d-attributes",
          ([
            id,
            x,
            y,
            z,
            vx,
            vy,
            vz,
            fx,
            fy,
            fz,
            ux,
            uy,
            uz,
            hasSeparateAttenuationPosition,
            ax,
            ay,
            az,
          ]) =>
            this.setListener3DAttributes(
              id,
              x,
              y,
              z,
              vx,
              vy,
              vz,
              fx,
              fy,
              fz,
              ux,
              uy,
              uz,
              hasSeparateAttenuationPosition,
              ax,
              ay,
              az
            ),
        ],
        [
          "set-listener-weight",
          ([id, weight]) => this.setListenerWeight(id, weight),
        ],
        ["set-nb-listeners", ([nb]) => this.setNbListeners(nb)],
        ["set-bus-muted", ([bus, muted]) => this.setBusMuted(bus, muted)],
        ["set-bus-volume", ([bus, volume]) => this.setBusVolume(bus, volume)],
        ["set-vca-volume", ([vca, volume]) => this.setVCAVolume(vca, volume)],
        [
          "set-suspended",
          ([suspended, time]) => this.setSuspended(suspended, time),
        ],
      ]);
    }

    nextTick(fn) {
      this.nextTickArray.push(fn);
    }

    PreInitLoadBank(path, preload, nonBlocking, name, url) {
      const bank = {
        path,
        preload,
        nonBlocking,
        name,
        url,
        loaded: false,
      };
      this.banks.push(bank);
      this.banksByName.set(name, bank);
      this.banksByPath.set(path, bank);
    }

    CreatePreloadedFiles() {
      // This helper function did not help at all so I'm giving up on using the excuse of a File System the FMOD API provides, and I am loading shit manually.
      return;
      this.banks.forEach((bank) => {
        this.FMOD.FS_createPreloadedFile(
          bank.path.split("/").slice(0, -1).join("/"),
          bank.name,
          bank.url,
          true,
          false,
          undefined,
          undefined,
          true
        );
      });
    }

    async WaitForPreloadBanks() {
      await Promise.all(
        this.banks.map(async (bank) => {
          if (bank.preload) {
            const promise = this.loadBank(bank);
            if (!bank.nonBlocking) await promise;
          }
        })
      );
    }

    PreInit() {
      return Promise.all([
        new Promise((resolve, reject) => {
          this._preRunCallbacks.push(() => {
            this.CreatePreloadedFiles();
            resolve();
          });
          this.HandleInit();
        }),
        new Promise((resolve, reject) => {
          this._initCallbacks.push(async () => {
            await this.WaitForPreloadBanks();
            resolve();
          });
        }),
      ]);
    }

    HandleInit() {
      if (!globalThis.FMODModule) {
        setTimeout(() => {
          this.HandleInit();
        }, 100);
        return;
      }
      globalThis.FMODModule(this.FMOD);
    }

    // ===== HELPER FUNCTIONS

    awaitBankLoadedState(bank, state) {
      return new Promise((resolve, reject) => {
        const outval = {};
        bank.bankHandle.getLoadingState(outval);
        if (outval.val === state) {
          resolve();
          return;
        }
        let interval = setInterval(() => {
          bank.bankHandle.getLoadingState(outval);
          if (outval.val === state) {
            clearInterval(interval);
            resolve();
          }
        }, 100);
      });
    }

    async fetchUrlAsInt8Array(url) {
      try {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const buffer = await response.arrayBuffer();
        return new Int8Array(buffer);
      } catch (error) {
        console.error("Error fetching URL:", error);
      }
    }

    assert(result) {
      if (result != this.FMOD.OK) {
        throw this.FMOD.ErrorString(result);
      }
    }

    // ===== FMOD SET UP FUNCTIONS

    preRun() {
      this._preRunCallbacks.forEach((cb) => cb());
      this._preRunCallbacks = [];
    }

    studioCallback(system, type, commanddata, userdata) {
      if (type === this.FMOD.STUDIO_SYSTEM_CALLBACK_BANK_UNLOAD) {
        var bank = commanddata;
        var outval = {};

        this.assert(bank.getUserData(outval));

        console.log("BANK_UNLOAD", outval);
      }
      return this.FMOD.OK;
    }

    initSystem() {
      const outval = {};

      this.assert(this.FMOD.Studio_System_Create(outval));
      this.gSystem = outval.val;
      this.assert(this.gSystem.getCoreSystem(outval));
      this.gSystemCore = outval.val;

      this.assert(this.gSystemCore.setDSPBufferSize(2048, 2));
      this.assert(
        this.gSystemCore.getDriverInfo(0, null, null, outval, null, null)
      );
      this.assert(
        this.gSystemCore.setSoftwareFormat(
          outval.val,
          this.FMOD.SPEAKERMODE_DEFAULT,
          0
        )
      );

      this.assert(
        this.gSystem.initialize(
          1024,
          this.FMOD.STUDIO_INIT_NORMAL,
          this.FMOD.INIT_NORMAL,
          null
        )
      );

      this.assert(
        this.gSystem.setAdvancedSettings({
          commandqueuesize: 0,
          handleinitialsize: 0,
          studioupdateperiod: 5,
          idlesampledatapoolsize: 0,
          streamingscheduledelay: 0,
        })
      );
    }

    onRuntimeInitialized() {
      // A temporary empty object to hold our system
      var result;

      this.initSystem();

      // Set up iOS/Chrome workaround.  Webaudio is not allowed to start unless screen is touched or button is clicked.
      const resumeAudio = (realTry = true) => {
        if (!this.gAudioResumed) {
          this.FMOD["OutputAudioWorklet_resumeAudio"]();
          this.assert(this.gSystemCore.mixerSuspend());
          this.assert(this.gSystemCore.mixerResume());
          if (realTry) {
            this.gAudioResumed = true;
          } else {
            this.FMOD.mInputRegistered = true;
          }
        }
      };

      const interactionEvents = [
        "click",
        "touchstart",
        "keydown",
        "mousedown",
        "mouseup",
        "touchend",
        "touchcancel",
      ];
      interactionEvents.forEach((event) => {
        document.addEventListener(event, resumeAudio);
      });

      this.assert(
        this.gSystem.setCallback(
          this.studioCallback.bind(this),
          this.FMOD.STUDIO_SYSTEM_CALLBACK_BANK_UNLOAD
        )
      );

      this._loaded = true;
      this._initCallbacks.forEach((cb) => cb());
      this._initCallbacks = [];

      resumeAudio(false);

      return this.FMOD.OK;
    }

    initEvent(event) {
      if (this.events[event]) return true;
      const outval = {};
      this.assert(this.gSystem.getEvent(event, outval));
      if (outval.val && outval.val.createInstance) {
        this.events[event] = {};
        this.events[event].description = outval.val;
        this.events[event].instance = new Map();
        this.events[event].allInstances = [];
        return true;
      }
      return false;
    }

    intiBus(bus) {
      if (this.buses[bus]) return true;
      const outval = {};
      this.assert(this.gSystem.getBus(bus, outval));
      if (outval.val) {
        this.buses[bus] = outval.val;
        return true;
      }
      return false;
    }

    initVCA(vca) {
      if (this.vcas[vca]) return true;
      const outval = {};
      this.assert(this.gSystem.getVCA(vca, outval));
      if (outval.val) {
        this.vcas[vca] = outval.val;
        return true;
      }
      return false;
    }

    // ===== FMOD ACTION FUNCTIONS

    async loadBank(bankOrName) {
      if (typeof bankOrName === "string") {
        bankOrName = this.banksByName.get(bankOrName);
        if (!bankOrName) {
          bankOrName = this.banksByPath.get(bankOrName);
        }
      }
      if (!bankOrName) {
        console.error("Bank not found.");
        return;
      }
      if (bankOrName.loaded) {
        return bankOrName;
      }
      let bankhandle = {};
      let memory = await this.fetchUrlAsInt8Array(bankOrName.url);
      let errno = this.gSystem.loadBankMemory(
        memory,
        memory.length,
        this.FMOD.STUDIO_LOAD_MEMORY,
        this.FMOD.STUDIO_LOAD_BANK_NORMAL,
        bankhandle
      );
      if (errno === this.FMOD.ERR_EVENT_ALREADY_LOADED) {
        console.error(
          "Bank already loaded. Make sure you're not loading the same bank twice under different names."
        );
        return bankOrName;
      }
      /*
        // This uses the filesystem, but it doesn't work.
        this.gSystem.loadBankFile(
          bankOrName.name,
          this.FMOD.STUDIO_LOAD_BANK_NORMAL,
          bankhandle
        )
      */
      this.assert(errno);
      bankOrName.bankHandle = bankhandle.val;
      await this.awaitBankLoadedState(
        bankOrName,
        this.FMOD.STUDIO_LOADING_STATE_LOADED
      );
      bankOrName.loaded = true;
      return bankOrName;
    }

    async unloadBank(bankOrName) {
      if (typeof bankOrName === "string") {
        bankOrName = this.banksByName.get(bankOrName);
        if (!bankOrName) {
          bankOrName = this.banksByPath.get(bankOrName);
        }
      }
      if (!bankOrName) {
        console.error("Bank not found.");
        return;
      }
      if (!bankOrName.loaded) {
        return bankOrName;
      }
      this.assert(this.gSystem.unloadBank(bankOrName.bankHandle));
      await this.awaitBankLoadedState(
        bankOrName,
        this.FMOD.STUDIO_LOADING_STATE_UNLOADED
      );
      bankOrName.loaded = false;
      return bankOrName;
    }
    async unloadAllBanks() {
      await Promise.all(
        this.banks.map(async (bank) => {
          await this.unloadBank(bank);
        })
      );
    }

    instantiateEvent(event, tags) {
      if (!this.initEvent(event)) return;
      const outval = {};
      this.assert(this.events[event].description.createInstance(outval));
      const tagArr = tags.split(" ");
      tagArr.forEach((tag) => {
        if (!this.events[event].instance.has(tag)) {
          this.events[event].instance.set(tag, []);
        }
        this.events[event].instance.get(tag).push(outval.val);
        this.events[event].allInstances.push(outval.val);
      });
    }

    startEvent(event, tag, destroyWhenStopped) {
      if (!this.initEvent(event)) return;
      let instancesInTag = this.events[event].instance.get(tag);
      if (!instancesInTag || instancesInTag.length === 0) {
        this.instantiateEvent(event, tag);
        instancesInTag = this.events[event].instance.get(tag);
      }
      instancesInTag.forEach((instance) => {
        this.assert(instance.start());
        if (destroyWhenStopped) {
          this.assert(instance.release());
        }
      });

      if (destroyWhenStopped) {
        this.nextTick(() => {
          this.events[event].allInstances = this.events[
            event
          ].allInstances.filter(
            (instance) => !instancesInTag.includes(instance)
          );
          this.events[event].instance.set(tag, []);
        });
      }
    }

    startOneTimeEvent(event) {
      if (!this.initEvent(event)) return;
      const outval = {};
      this.assert(this.events[event].description.createInstance(outval));
      this.assert(outval.val.start());
      this.assert(outval.val.release());
    }

    setEventPaused(event, tag, paused) {
      if (!this.initEvent(event)) return;
      let instancesInTag = this.events[event].instance.get(tag);
      if (!instancesInTag || instancesInTag.length === 0) {
        return;
      }
      instancesInTag.forEach((instance) => {
        this.assert(instance.setPaused(!paused));
      });
    }

    stopEvent(event, tag, allowFadeOut, release) {
      if (!this.initEvent(event)) return;
      let instancesInTag = this.events[event].instance.get(tag);
      if (!instancesInTag || instancesInTag.length === 0) {
        return;
      }
      instancesInTag.forEach((instance) => {
        this.assert(
          instance.stop(
            allowFadeOut
              ? this.FMOD.STUDIO_STOP_ALLOWFADEOUT
              : this.FMOD.STUDIO_STOP_IMMEDIATE
          )
        );
        if (release) {
          this.assert(instance.release());
        }
      });

      if (release) {
        this.events[event].allInstances = this.events[
          event
        ].allInstances.filter((instance) => !instancesInTag.includes(instance));
        this.events[event].instance.set(tag, []);
      }
    }

    stopAllEvents(event, allowFadeOut, release) {
      if (!this.initEvent(event)) return;
      this.events[event].allInstances.forEach((instance) => {
        this.assert(
          instance.stop(
            allowFadeOut
              ? this.FMOD.STUDIO_STOP_ALLOWFADEOUT
              : this.FMOD.STUDIO_STOP_IMMEDIATE
          )
        );
        if (release) {
          this.assert(instance.release());
        }
      });

      if (release) {
        this.events[event].instance = new Map();
        this.events[event].allInstances = [];
      }
    }

    releaseEvent(event, tag) {
      if (!this.initEvent(event)) return;
      let instancesInTag = this.events[event].instance.get(tag);
      if (!instancesInTag || instancesInTag.length === 0) {
        return;
      }
      instancesInTag.forEach((instance) => {
        this.assert(instance.release());
      });
      this.events[event].allInstances = this.events[event].allInstances.filter(
        (instance) => !instancesInTag.includes(instance)
      );
      this.events[event].instance.set(tag, []);
    }

    releaseAllEventInstances(event) {
      if (!this.initEvent(event)) return;
      this.events[event].allInstances.forEach((instance) => {
        this.assert(instance.release());
      });
      this.events[event].instance = new Map();
      this.events[event].allInstances = [];
    }

    setEventParameter(event, tag, parameter, value, ignoreSeekSpeed) {
      if (!this.initEvent(event)) return;
      let instancesInTag = this.events[event].instance.get(tag);
      if (!instancesInTag || instancesInTag.length === 0) {
        return;
      }
      instancesInTag.forEach((instance) => {
        this.assert(
          instance.setParameterByName(parameter, value, ignoreSeekSpeed)
        );
      });
    }

    setEventParameterWithLabel(event, tag, parameter, value, ignoreSeekSpeed) {
      if (!this.initEvent(event)) return;
      let instancesInTag = this.events[event].instance.get(tag);
      if (!instancesInTag || instancesInTag.length === 0) {
        return;
      }
      instancesInTag.forEach((instance) => {
        this.assert(
          instance.setParameterByNameWithLabel(
            parameter,
            value,
            ignoreSeekSpeed
          )
        );
      });
    }

    setGlobalParameter(parameter, value, ignoreSeekSpeed) {
      if (!this.gSystem) return;
      this.assert(
        this.gSystem.setParameterByName(parameter, value, ignoreSeekSpeed)
      );
    }

    setGlobalParameterWithLabel(parameter, value, ignoreSeekSpeed) {
      if (!this.gSystem) return;
      this.assert(
        this.gSystem.setParameterByNameWithLabel(
          parameter,
          value,
          ignoreSeekSpeed
        )
      );
    }

    setEvent3DAttributes(
      event,
      tag,
      x,
      y,
      z,
      vx,
      vy,
      vz,
      fx,
      fy,
      fz,
      ux,
      uy,
      uz
    ) {
      if (!this.initEvent(event)) return;
      let instancesInTag = this.events[event].instance.get(tag);
      if (!instancesInTag || instancesInTag.length === 0) {
        return;
      }
      const attributes = this.FMOD._3D_ATTRIBUTES();
      attributes.position = {
        x,
        y,
        z,
      };
      attributes.velocity = {
        x: vx,
        y: vy,
        z: vz,
      };
      attributes.forward = {
        x: fx,
        y: fy,
        z: fz,
      };
      attributes.up = {
        x: ux,
        y: uy,
        z: uz,
      };
      instancesInTag.forEach((instance) => {
        this.assert(instance.set3DAttributes(attributes));
      });
    }

    setListener3DAttributes(
      id,
      x,
      y,
      z,
      vx,
      vy,
      vz,
      fx,
      fy,
      fz,
      ux,
      uy,
      uz,
      hasSeparateAttenuationPosition,
      ax,
      ay,
      az
    ) {
      if (!this.gSystem) return;
      const attributes = this.FMOD._3D_ATTRIBUTES();
      attributes.position = {
        x,
        y,
        z,
      };
      attributes.velocity = {
        x: vx,
        y: vy,
        z: vz,
      };
      attributes.forward = {
        x: fx,
        y: fy,
        z: fz,
      };
      attributes.up = {
        x: ux,
        y: uy,
        z: uz,
      };
      if (hasSeparateAttenuationPosition) {
        this.assert(
          this.gSystem.setListenerAttributes(id, attributes, {
            x: ax,
            y: ay,
            z: az,
          })
        );
      } else {
        this.assert(this.gSystem.setListenerAttributes(id, attributes, null));
      }
    }

    setListenerWeight(id, weight) {
      if (!this.gSystem) return;
      this.assert(this.gSystem.setListenerWeight(id, weight));
    }

    setNbListeners(nb) {
      if (!this.gSystem) return;
      this.assert(this.gSystem.setNumListeners(nb));
    }

    setBusMuted(bus, muted) {
      if (!this.intiBus(bus)) return;
      this.assert(this.buses[bus].setMute(muted));
    }
    setBusVolume(bus, volume) {
      if (!this.intiBus(bus)) return;
      this.assert(this.buses[bus].setVolume(volume));
    }
    setVCAVolume(vca, volume) {
      if (!this.initVCA(vca)) return;
      this.assert(this.vcas[vca].setVolume(volume));
    }

    setSuspended(suspended, time) {
      if (!this.gSystemCore) return;
      if (time <= this.lastSuspendTime) return;
      this.lastSuspendTime = time;
      if (suspended) {
        this.assert(this.gSystemCore.mixerSuspend());
      } else {
        this.assert(this.gSystemCore.mixerResume());
      }
    }

    update() {
      if (!this.banks || !this.gSystem || !this.gSystemCore) return;
      this.nextTickArray.forEach((fn) => fn());
      this.nextTickArray = [];
      /*
      var outval = {};
      for (let i = 0; i < this.banks.length; i++) {
        let bank = this.banks[i];
        if (bank.bank && bank.bank.isValid()) {
          this.assert(bank.bank.getLoadingState(outval));
          if (outval && outval.val) {
            bank.loadState = outval.val;
          }
        }

        if (
          bank.bank &&
          bank.loadState === this.FMOD.STUDIO_LOADING_STATE_LOADED
        ) {
          this.assert(bank.bank.getSampleLoadingState(outval));
          if (outval && outval.val) {
            bank.sampleLoadState = outval.val;
          }
          if (
            this.gWantSampleLoad &&
            bank.sampleLoadState === this.FMOD.STUDIO_LOADING_STATE_UNLOADED
          ) {
            this.assert(bank.bank.loadSampleData());
          } else if (
            !this.gWantSampleLoad &&
            (bank.sampleLoadState === this.FMOD.STUDIO_LOADING_STATE_LOADING ||
              bank.sampleLoadState === this.FMOD.STUDIO_LOADING_STATE_LOADED)
          ) {
            this.assert(bank.bank.unloadSampleData());
          }
        }
      }

      var dsp = {};
      var stream = {};
      var update = {};
      var total = {};
      //this.assert(this.gSystemCore.getCPUUsage(dsp, stream, null, update, total));
      var channelsplaying = {};
      this.assert(this.gSystemCore.getChannelsPlaying(channelsplaying, null));
      var numbuffers = {};
      var buffersize = {};
      this.assert(this.gSystemCore.getDSPBufferSize(buffersize, numbuffers));
      var rate = {};
      this.assert(this.gSystemCore.getSoftwareFormat(rate, null, null));
      var sysrate = {};
      this.assert(
        this.gSystemCore.getDriverInfo(0, null, null, sysrate, null, null)
      );
      var ms = (numbuffers.val * buffersize.val * 1000) / rate.val;
      communicateWithRuntime({
        type: "updateStats",
        stats: {
          dsp,
          stream,
          update,
          total,
          channelsplaying,
          numbuffers,
          buffersize,
          rate,
          sysrate,
          ms,
        },
      });
      */
      // Update FMOD
      this.assert(this.gSystem.update());
    }
  };

  self.RuntimeInterface.AddDOMHandlerClass(HANDLER_CLASS);
}
