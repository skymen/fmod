function getInstanceJs(parentClass, scriptInterface, addonTriggers, C3) {
  return class extends parentClass {
    constructor(inst, properties) {
      super(inst);
      this.allBanks = [];
      this.autoSuspend = true;
      if (properties) {
        const allBanks = properties[0].split("\n");
        const preloadBanks = properties[1].split("\n");
        const preloadBanksNonBlocking = properties[2].split("\n");
        this.autoSuspend = properties[3];
        (async () => {
          for (let i = 0; i < allBanks.length; i++) {
            const bank = allBanks[i];
            if (this.allBanks.find((x) => x.path === bank)) continue;
            if (!bank || bank.trim() === "") continue;
            this.allBanks.push({
              path: bank,
              preload: false,
              nonBlocking: true,
              name: bank.split("/").pop(),
              url: await this._runtime._assetManager.GetProjectFileUrl(bank),
            });
          }
          for (let i = 0; i < preloadBanks.length; i++) {
            const preloadBank = preloadBanks[i];
            if (!preloadBank || preloadBank.trim() === "") continue;
            const bank = this.allBanks.find((x) => x.path === preloadBank);
            if (bank) {
              bank.preload = true;
              bank.nonBlocking = false;
            } else {
              this.allBanks.push({
                path: preloadBank,
                preload: true,
                nonBlocking: false,
                name: preloadBank.split("/").pop(),
                url: await this._runtime._assetManager.GetProjectFileUrl(
                  preloadBank
                ),
              });
            }
          }
          for (let i = 0; i < preloadBanksNonBlocking.length; i++) {
            const preloadBank = preloadBanksNonBlocking[i];
            if (!preloadBank || preloadBank.trim() === "") continue;
            const bank = this.allBanks.find((x) => x.path === preloadBank);
            if (bank) {
              bank.preload = true;
              bank.nonBlocking = true;
            } else {
              this.allBanks.push({
                path: preloadBank,
                preload: true,
                nonBlocking: true,
                name: preloadBank.split("/").pop(),
                url: await this._runtime._assetManager.GetProjectFileUrl(
                  preloadBank
                ),
              });
            }
          }
        })();
      }

      this.cppInst = null;
      this.jsInst = null;
      this.curInst = null;
      this._runtime.AddLoadPromise(
        new Promise((resolve) => {
          runOnStartup(async () => {
            await this.PreInit();
            resolve();
          });
        })
      );
      this._runtime.Dispatcher().addEventListener("suspend", () => {
        this.OnSuspend(true);
      });
      this._runtime.Dispatcher().addEventListener("resume", () => {
        this.OnSuspend(false);
      });
      this._StartTicking();
    }

    OnSuspend(suspended) {
      if (this.autoSuspend) {
        this._SetSuspended(suspended);
      }
    }

    async PreInit() {
      this.jsInst = C3.Plugins.skymen_fmod_js
        ? this._runtime._allObjectClasses.find(
            (x) => x._plugin instanceof C3.Plugins.skymen_fmod_js
          )
        : null;
      if (this.jsInst) this.jsInst = this.jsInst._instances[0]._sdkInst;
      this.cppInst = C3.Plugins.skymen_fmod_cpp
        ? this._runtime._allObjectClasses.find(
            (x) => x._plugin instanceof C3.Plugins.skymen_fmod_cpp
          )
        : null;
      if (this.cppInst) this.cppInst = this.cppInst._instances[0]._sdkInst;

      if (this.cppInst && this.cppInst._isWrapperExtensionAvailable)
        this.curInst = this.cppInst;
      else if (this.jsInst) this.curInst = this.jsInst;
      else {
        let message = "";
        if (this.cppInst)
          message =
            "CPP fmod implementation is not supported on this platform. Please add a fmod JS API to your project";
        else
          message =
            "No fmod implementation found. Please add a fmod JS API or CPP API to your project.";

        alert(message);
        throw new Error(message);
      }
      await Promise.all(
        this.allBanks.map(async (bank) => {
          await this.curInst.SendMessageAsync("pre-init-load-bank", [
            bank.path,
            bank.preload,
            bank.nonBlocking,
            bank.name,
            bank.url,
          ]);
        })
      );
      await this.curInst.SendMessageAsync("pre-init");
    }

    Tick() {
      if (!this.curInst) return;
      this.curInst.SendMessage("update");
    }

    Release() {
      super.Release();
    }

    SaveToJson() {
      return {
        // data to be saved for savegames
      };
    }

    LoadFromJson(o) {
      // load state for savegames
    }

    Trigger(method) {
      super.Trigger(method);
      const addonTrigger = addonTriggers.find((x) => x.method === method);
      if (addonTrigger) {
        this.GetScriptInterface().dispatchEvent(new C3.Event(addonTrigger.id));
      }
    }

    GetScriptInterfaceClass() {
      return scriptInterface;
    }

    // === ACTIONS ===
    async _LoadBank(name) {
      if (!this.curInst) return;
      await this.curInst.SendMessageAsync("load-bank", [name]);
    }
    async _UnloadBank(name) {
      if (!this.curInst) return;
      await this.curInst.SendMessageAsync("unload-bank", [name]);
    }
    async _UnloadAllBanks() {
      if (!this.curInst) return;
      await this.curInst.SendMessageAsync("unload-all-banks");
    }
    async _StartOneTimeEvent(eventName) {
      if (!this.curInst) return;
      await this.curInst.SendMessageAsync("start-one-time-event", [eventName]);
    }
    async _InstantiateEvent(name, tags) {
      if (!this.curInst) return;
      await this.curInst.SendMessageAsync("instantiate-event", [name, tags]);
    }
    async _StartEvent(name, tag, destroyWhenStopped) {
      if (!this.curInst) return;
      await this.curInst.SendMessageAsync("start-event", [
        name,
        tag,
        destroyWhenStopped,
      ]);
    }
    async _SetEventParameter(name, tag, param, value, ignoreSeekSpeed) {
      if (!this.curInst) return;
      await this.curInst.SendMessageAsync("set-event-parameter", [
        name,
        tag,
        param,
        value,
        ignoreSeekSpeed,
      ]);
    }
    async _SetEventParameterWithLabel(
      name,
      tag,
      param,
      value,
      ignoreSeekSpeed
    ) {
      if (!this.curInst) return;
      await this.curInst.SendMessageAsync("set-event-parameter-with-label", [
        name,
        tag,
        param,
        value,
        ignoreSeekSpeed,
      ]);
    }
    async _SetGlobalParameter(param, value, ignoreSeekSpeed) {
      if (!this.curInst) return;
      await this.curInst.SendMessageAsync("set-global-parameter", [
        param,
        value,
        ignoreSeekSpeed,
      ]);
    }
    async _SetGlobalParameterWithLabel(param, value, ignoreSeekSpeed) {
      if (!this.curInst) return;
      await this.curInst.SendMessageAsync("set-global-parameter-with-label", [
        param,
        value,
        ignoreSeekSpeed,
      ]);
    }
    async _StopEvent(name, tag, allowFadeOut, release) {
      if (!this.curInst) return;
      await this.curInst.SendMessageAsync("stop-event", [
        name,
        tag,
        allowFadeOut,
        release,
      ]);
    }
    async _StopAllEvents(name, allowFadeOut, release) {
      if (!this.curInst) return;
      await this.curInst.SendMessageAsync("stop-all-events", [
        name,
        allowFadeOut,
        release,
      ]);
    }
    async _ReleaseEventInstance(name, tag) {
      if (!this.curInst) return;
      await this.curInst.SendMessageAsync("release-event", [name, tag]);
    }
    async _ReleaseAllEventInstances(name) {
      if (!this.curInst) return;
      await this.curInst.SendMessageAsync("release-all-event-instances", [
        name,
      ]);
    }
    async _SetEventPaused(name, tag, paused) {
      if (!this.curInst) return;
      await this.curInst.SendMessageAsync("set-event-paused", [
        name,
        tag,
        paused,
      ]);
    }
    async _SetEvent3DAttributes(
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
    ) {
      if (!this.curInst) return;
      await this.curInst.SendMessageAsync("set-event-3d-attributes", [
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
        uz,
      ]);
    }
    async _SetEvent3DAttributesFromObject(
      name,
      tag,
      objectClass,
      forwardMode,
      vx,
      vy,
      vz
    ) {
      if (!this.curInst) return;
      const inst = objectClass._instances[0]._sdkInst;
      const [x, y, z] = [
        inst.GetWorldInfo().GetX(),
        inst.GetWorldInfo().GetY(),
        inst.GetWorldInfo().GetZElevation(),
      ];
      const angle = inst.GetWorldInfo().GetAngle();
      let fx = 0;
      let fy = 0;
      let fz = 1;
      let ux = 0;
      let uy = -1;
      let uz = 0;
      if (forwardMode === 1)
        [fx, fy, fz, ux, uy, uz] = [
          Math.cos(angle),
          Math.sin(angle),
          0,
          0,
          0,
          1,
        ];
      await this._SetEvent3DAttributes(
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
      );
    }
    async _SetEvent3DAttributesSimpleFromObject(
      name,
      tag,
      objectClass,
      forwardMode
    ) {
      await this._SetEvent3DAttributesFromObject(
        name,
        tag,
        objectClass,
        forwardMode,
        0, //vx,
        0, //vy,
        0 //vz
      );
    }
    async _SetEvent3DAttributesSimple(name, tag, x, y, z) {
      if (!this.curInst) return;
      this._SetEvent3DAttributes(
        name,
        tag,
        x,
        y,
        z,
        0, //vx,
        0, //vy,
        0, //vz,
        0, //fx,
        0, //fy,
        1, //fz,
        0, //ux,
        -1, //uy,
        0 //uz,
      );
    }
    async _SetListener3DAttributes(
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
      if (!this.curInst) return;
      await this.curInst.SendMessageAsync("set-listener-3d-attributes", [
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
      ]);
    }

    async _SetListener3DAttributesFromCamera(
      id,
      camera,
      vx,
      vy,
      vz,
      hasSeparateAttenuationPosition,
      ax,
      ay,
      az
    ) {
      if (!this.curInst) return;
      const inst = camera._instances[0]._sdkInst;
      const layout = this._runtime.GetMainRunningLayout();
      const [x, y, z] = layout.Get3DCameraPosition();
      const [ux, uy, uz] = inst._GetUpVector();
      const [fx, fy, fz] = inst._GetForwardVector();
      await this._SetListener3DAttributes(
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
      );
    }

    async _SetListener3DAttributesFromScrollPosition(
      id,
      vx,
      vy,
      hasSeparateAttenuationPosition,
      ax,
      ay
    ) {
      if (!this.curInst) return;
      const layout = this._runtime.GetMainRunningLayout();
      const x = layout.GetScrollX();
      const y = layout.GetScrollY();
      await this._SetListener3DAttributes(
        id,
        x,
        y,
        0, //z,
        vx,
        vy,
        0, //vz,
        0, //fx,
        0, //fy,
        -1, //fz,
        0, //ux,
        -1, //uy,
        0, //uz,
        hasSeparateAttenuationPosition,
        ax,
        ay,
        0 //az
      );
    }

    async _SetListener3DAttributesSimple(id, x, y, z) {
      if (!this.curInst) return;
      await this._SetListener3DAttributes(
        id,
        x,
        y,
        z,
        0, //vx,
        0, //vy,
        0, //vz,
        0, //fx,
        0, //fy,
        -1, //fz,
        0, //ux,
        -1, //uy,
        0, //uz,
        false, //hasSeparateAttenuationPosition,
        0, //ax,
        0, //ay,
        0 //az
      );
    }
    async _SetListener3DAttributesSimpleFromScrollPosition(id) {
      if (!this.curInst) return;
      const layout = this._runtime.GetMainRunningLayout();
      const x = layout.GetScrollX();
      const y = layout.GetScrollY();
      await this._SetListener3DAttributesSimple(id, x, y, 0);
    }

    async _SetListenerWeight(id, weight) {
      if (!this.curInst) return;
      await this.curInst.SendMessageAsync("set-listener-weight", [id, weight]);
    }
    async _SetNbListeners(nb) {
      if (!this.curInst) return;
      await this.curInst.SendMessageAsync("set-nb-listeners", [nb]);
    }

    async _SetBusMuted(bus, muted) {
      if (!this.curInst) return;
      await this.curInst.SendMessageAsync("set-bus-muted", [bus, muted]);
    }
    async _SetBusVolume(bus, volume) {
      if (!this.curInst) return;
      await this.curInst.SendMessageAsync("set-bus-volume", [bus, volume]);
    }
    async _SetVCAVolume(vca, volume) {
      if (!this.curInst) return;
      await this.curInst.SendMessageAsync("set-vca-volume", [vca, volume]);
    }

    _SetAutoSuspend(value) {
      this.autoSuspend = value;
    }
    async _SetSuspended(value) {
      if (!this.curInst) return;
      await this.curInst.SendMessageAsync("set-suspended", [
        value,
        performance.now(),
      ]);
    }

    // === CONDITIONS ===
    _IsInitialised() {
      return !!this.curInst;
    }
  };
}
