function getScriptInterface(parentClass, map) {
  return class extends parentClass {
    constructor() {
      super();
      map.set(this, parentClass._GetInitInst().GetSdkInstance());
      this.FORWARD_MODE = {
        _2D: 0,
        _3D: 1,
      };
    }

    async SetListener3DAttributesFromCamera(
      id,
      camera,
      vx = 0,
      vy = 0,
      vz = 0,
      hasSeparateAttenuationPosition = false,
      ax = 0,
      ay = 0,
      az = 0
    ) {
      const inst = map.get(this);
      if (camera.getFirstPickedInstance)
        camera = camera.getFirstPickedInstance();
      if (!inst) return;
      const cameraObjectClass = inst._runtime.GetInstanceByUID(
        camera.uid
      )._objectType;
      await inst._SetListener3DAttributesFromCamera(
        id,
        cameraObjectClass,
        vx,
        vy,
        vz,
        hasSeparateAttenuationPosition,
        ax,
        ay,
        az
      );
    }

    async SetEvent3DAttributesFromObject(
      name,
      tag,
      objectClass,
      forwardMode = 0,
      vx = 0,
      vy = 0,
      vz = 0
    ) {
      const inst = map.get(this);
      if (!inst) return;
      if (objectClass.getFirstPickedInstance)
        objectClass = objectClass.getFirstPickedInstance();
      const worldObjectClass = inst._runtime.GetInstanceByUID(
        objectClass.uid
      )._objectType;
      await inst._SetEvent3DAttributesFromObject(
        name,
        tag,
        worldObjectClass,
        forwardMode,
        vx,
        vy,
        vz
      );
    }
    async SetEvent3DAttributesSimpleFromObject(
      name,
      tag,
      objectClass,
      forwardMode = 0
    ) {
      await this.SetEvent3DAttributesFromObject(
        name,
        tag,
        objectClass,
        forwardMode,
        0, //vx,
        0, //vy,
        0 //vz
      );
    }
  };
}
