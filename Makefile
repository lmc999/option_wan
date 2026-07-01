include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-option-wan
PKG_VERSION:=0.1.0
PKG_RELEASE:=2

PKG_LICENSE:=MIT
PKG_MAINTAINER:=lmc999

LUCI_TITLE:=LuCI support for destination based WAN routing
LUCI_DEPENDS:=+luci-base +ip-full +jsonfilter
LUCI_PKGARCH:=all

define Package/$(PKG_NAME)/postinst
#!/bin/sh
[ -n "$${IPKG_INSTROOT}" ] || {
	/etc/uci-defaults/90-option-wan >/dev/null 2>&1
	/etc/init.d/option-wan enable >/dev/null 2>&1
	/etc/init.d/option-wan start >/dev/null 2>&1
}
exit 0
endef

define Package/$(PKG_NAME)/prerm
#!/bin/sh
[ -n "$${IPKG_INSTROOT}" ] || /usr/sbin/option-wan clear >/dev/null 2>&1 || true
exit 0
endef

include $(TOPDIR)/feeds/luci/luci.mk

# call BuildPackage - OpenWrt buildroot signature
