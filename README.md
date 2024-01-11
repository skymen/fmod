This is a bundle of 3 addons for Construct 3.

# FMOD

This is the "controller" addon. It contains all the actions, conditions, and expressions that are used to control the FMOD system.
It does not do anything on its own, but instead detects when an FMOD API object exists in the project and uses it to execute the actions.

# FMOD - JS API

This is the JS implementation of the FMOD API.
It generally has most of the features you might want but suffers from a few limiations, namely:

- No multithreading
- No connection to the FMOD Studio application for live reload
- No support for the FMOD Profiler
- It's limited by the browser's audio capabilities
- Bank loading needs to be done differently because it is designed for a server environment

# FMOD - C++ API

This is the C++ implementation of the FMOD API.
It is only available on the WebView2 export, but right now this addon hasn't been worked on yet.
