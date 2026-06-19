# luci-app-option-wan

OpenWrt LuCI plugin for routing selected destination IPv4 addresses or CIDR blocks through a chosen network interface.

The package is designed for multi-WAN or dedicated-line environments where WAN interfaces may reconnect and receive new ISP-assigned parameters. Rules are reapplied on boot, config reload, and interface hotplug events.

## Features

- Add destination IPv4/CIDR rules from LuCI.
- Use a PassWall node as the destination source. IPv4 node addresses are used directly; domain nodes are resolved to IPv4 A records on each apply.
- Bind each destination to an OpenWrt logical network interface, such as `wan`, `wan2`, or `leased_line`.
- Rebuild policy routing after interface reconnects.
- Block matched destinations while the selected interface is down, preventing fallback through another default WAN.
- Store configuration in `/etc/config/option_wan`.

## Build

Place this directory in an OpenWrt feed or package directory, then build it with the OpenWrt SDK:

```sh
make package/luci-app-option-wan/compile V=s
```

The resulting `.ipk` will be under `bin/packages/<arch>/<feed>/`.

## Runtime commands

```sh
/etc/init.d/option-wan enable
/etc/init.d/option-wan start
/usr/sbin/option-wan apply
/usr/sbin/option-wan clear
/usr/sbin/option-wan status
```

## Notes

- IPv4 only in the first version.
- PassWall integration reads only node display and address fields from `/etc/config/passwall`.
- The selected egress interface must already be configured correctly in OpenWrt, including firewall/NAT if needed.
- The package does not depend on `mwan3`.
