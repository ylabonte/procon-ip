# procon-ip
[![NPM](https://nodei.co/npm/procon-ip.png?downloads=true&downloadRank=true&stars=true)](https://nodei.co/npm/procon-ip/)
<!-- [![NPM](https://nodei.co/npm-dl/procon-ip.png)](https://nodei.co/npm/procon-ip/) -->

Package info  
[![npm version](https://badge.fury.io/js/procon-ip.svg)](https://badge.fury.io/js/procon-ip)
![GitHub](https://img.shields.io/github/license/ylabonte/procon-ip)
![GitHub issues](https://img.shields.io/github/issues-raw/ylabonte/procon-ip)  
[![Dependency Status](https://img.shields.io/david/ylabonte/procon-ip.svg)](https://david-dm.org/ylabonte/procon-ip)
[![Known Vulnerabilities](https://snyk.io/test/github/ylabonte/procon-ip/badge.svg)](https://snyk.io/test/github/ylabonte/procon-ip)
[![Total alerts](https://img.shields.io/lgtm/alerts/g/ylabonte/procon-ip.svg?logo=lgtm&logoWidth=18)](https://lgtm.com/projects/g/ylabonte/procon-ip/alerts/)
[![Language grade: JavaScript](https://img.shields.io/lgtm/grade/javascript/g/ylabonte/procon-ip.svg?logo=lgtm&logoWidth=18)](https://lgtm.com/projects/g/ylabonte/procon-ip/context:javascript)  
![CI Workflow](https://github.com/ylabonte/procon-ip/workflows/CI%20Workflow/badge.svg)
![CodeQL](https://github.com/ylabonte/procon-ip/workflows/CodeQL/badge.svg)
![Github Package release](https://github.com/ylabonte/procon-ip/workflows/Github%20Package%20Release/badge.svg)
![NPM Package release](https://github.com/ylabonte/procon-ip/workflows/NPM%20Package%20Release/badge.svg)


## What's this library for?
The name of this library refers to the [ProCon.IP pool controller](#what-is-procon-ip). 
Documentation might follow. Until this please take a look at the sources. I
tried to keep the interfaces readable. An IDE with proper auto-completion should
help understand and use the library without further documentation.

Feel free to ask questions by using githubs issues system, so others can take 
part and are able to find the answer if they have a similar question. Thanks! :)


<a name="what-is-procon-ip"></a>

## What is the ProCon.IP pool controller?
![Picture from pooldigital.de](https://www.pooldigital.de/shop/media/image/66/47/a5/ProConIP1_720x600.png)

The ProCon.IP pool controller is a low budget network attached control unit for
home swimming pools. With its software switched relays, it can control
multiple pumps (for the pool filter and different dosage aspects) either
simply planned per time schedule or depending on a reading/value from one of
its many input channels for measurements (eg. i/o flow sensors, Dallas 1-Wire
termometers, redox and pH electrodes). At least there is also the option to
switch these relays on demand, which makes them also applicable for switching
lights (or anything else you want) on/off.
Not all of its functionality is reachable via API. In fact there is one
documented API for reading (polling) values as CSV (`/GetState.csv`). In my
memories there was another one for switching the relays on/off and on with
timer. But I cannot find the second one anymore. So not even pretty, but
functional: The ProCon.IP has two native web interfaces, which can be
analyzed, to some kind of reverse engineer a given functionality (like
switching the relays).

For more information see the following link (sorry it's only in german;
haven't found an english documentation/information so far):
* [pooldigital.de webshop](https://www.pooldigital.de/shop/poolsteuerungen/procon.ip/35/procon.ip-webbasierte-poolsteuerung-/-dosieranlage)
* [pooldigital.de forum](http://forum.pooldigital.de/)

**Just to be clear: I have nothing to do with the development, sellings,
marketing or support of the pool controller unit itself. I just developed a 
solution to integrate such with [ioBroker](https://github.com/ylabonte/ioBroker.procon-ip)
and now decoupled the library part to make it cleaner.**
