#!/bin/sh
set -eu

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"

check_shell() {
	file="$1"
	sh -n "$file"
}

check_json() {
	file="$1"
	if command -v python3 >/dev/null 2>&1; then
		python3 -m json.tool "$file" >/dev/null
	elif command -v json_pp >/dev/null 2>&1; then
		json_pp < "$file" >/dev/null
	fi
}

check_shell "$ROOT_DIR/root/usr/sbin/option-wan"
check_shell "$ROOT_DIR/root/etc/init.d/option-wan"
check_shell "$ROOT_DIR/root/etc/hotplug.d/iface/95-option-wan"
check_shell "$ROOT_DIR/root/etc/uci-defaults/90-option-wan"

check_json "$ROOT_DIR/root/usr/share/luci/menu.d/luci-app-option-wan.json"
check_json "$ROOT_DIR/root/usr/share/rpcd/acl.d/luci-app-option-wan.json"
check_json "$ROOT_DIR/root/usr/share/ucitrack/luci-app-option-wan.json"

grep -q '"init": "option-wan"' \
	"$ROOT_DIR/root/usr/share/ucitrack/luci-app-option-wan.json"
grep -q "return callUciCommit('option_wan')" \
	"$ROOT_DIR/htdocs/luci-static/resources/view/option-wan/rules.js"
grep -q "method: 'commit'" \
	"$ROOT_DIR/htdocs/luci-static/resources/view/option-wan/rules.js"

echo "static checks passed"
