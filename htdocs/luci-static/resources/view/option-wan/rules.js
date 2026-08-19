'use strict';
'require view';
'require form';
'require uci';
'require network';
'require fs';
'require ui';
'require rpc';

var callUciCommit = rpc.declare({
	object: 'uci',
	method: 'commit',
	params: [ 'config' ],
	reject: true
});

function isIPv4(value) {
	var parts = String(value || '').split('.');

	if (parts.length !== 4)
		return false;

	for (var i = 0; i < parts.length; i++) {
		if (!/^[0-9]+$/.test(parts[i]))
			return false;

		var n = Number(parts[i]);
		if (n < 0 || n > 255)
			return false;
	}

	return true;
}

function isIPv4CIDR(value) {
	var parts = String(value || '').split('/');

	if (parts.length > 2 || !isIPv4(parts[0]))
		return false;

	if (parts.length === 1)
		return true;

	if (!/^[0-9]+$/.test(parts[1]))
		return false;

	var prefix = Number(parts[1]);
	return prefix >= 0 && prefix <= 32;
}

function helpText(text) {
	return E('span', {
		'style': 'color:#6f86a8;font-size:12px;line-height:1.6;'
	}, text);
}

function saveAndApply(map) {
	return map.save().then(function() {
		return callUciCommit('option_wan');
	}).then(function() {
		return fs.exec('/usr/sbin/option-wan', [ 'apply' ]);
	}).then(function() {
		ui.changes.setIndicator(0);
	});
}

return view.extend({
	load: function() {
		return Promise.all([
			uci.load('option_wan'),
			network.getNetworks(),
			fs.exec('/usr/sbin/option-wan', [ 'passwall-nodes' ]).catch(function() {
				return { stdout: '[]' };
			})
		]);
	},

	handleSave: function() {
		return saveAndApply(this.map).then(function() {
			ui.addNotification(null, E('p', _('配置已保存，指定出口规则已应用。')));
		}).catch(function(err) {
			ui.addNotification(null, E('p', _('保存或应用指定出口规则失败：') + err.message), 'error');
			throw err;
		});
	},

	handleSaveApply: function() {
		return this.handleSave();
	},

	render: function(data) {
		var networks = data[1];
		var passwallNodes = [];
		var passwallNodeMap = {};
		var m, s, o;

		try {
			passwallNodes = JSON.parse((data[2] && data[2].stdout) || '[]') || [];
		} catch (e) {
			passwallNodes = [];
		}

		passwallNodes.forEach(function(node) {
			var id = node.id;
			var remarks = node.remarks || id;
			var protocol = node.protocol || node.type || '';
			var address = node.address || '';
			var label = remarks;

			if (protocol)
				label += ' [' + protocol + ']';

			if (address)
				label += ' - ' + address;

			passwallNodeMap[id] = {
				label: label,
				remarks: remarks,
				address: address
			};
		});

		m = new form.Map('option_wan', _('目标 IP 指定出口'),
			_('使用方法：开启插件后，在下方新增规则，填写公网目标 IPv4 或 CIDR，并选择要走的 OpenWrt 网络接口，例如 wan2。保存并应用后，访问该目标的流量会固定从所选接口出口；宽带重拨后会自动重新应用规则。若所选出口不可用，对应目标会被阻断，避免流量泄漏到其他默认线路。'));

		s = m.section(form.NamedSection, 'global', 'global', _('全局设置'),
			_('通常只需要打开启用开关即可。高级用户可调整策略路由优先级和路由表起始编号，以避开系统中已有的策略路由规则。'));
		s.addremove = false;

		o = s.option(form.Flag, 'enabled', _('启用'));
		o.default = o.disabled;
		o.rmempty = false;

		o = s.option(form.Value, 'priority_base', _('起始规则优先级'));
		o.datatype = 'range(1,32765)';
		o.placeholder = '900';
		o.default = '900';
		o.description = _('每条规则会从该数值开始依次分配 ip rule 优先级。数值越小优先级越高。');

		o = s.option(form.Value, 'table_base', _('起始路由表编号'));
		o.datatype = 'range(1,4294967295)';
		o.placeholder = '21000';
		o.default = '21000';
		o.description = _('每条规则会从该数值开始依次分配独立路由表。');

		o = s.option(form.Button, '_apply', _('立即应用规则'));
		o.inputstyle = 'apply';
		o.onclick = function() {
			return saveAndApply(m).then(function() {
				ui.addNotification(null, E('p', _('指定出口规则已应用。')));
			}).catch(function(err) {
				ui.addNotification(null, E('p', _('应用指定出口规则失败：') + err.message), 'error');
			});
		};

		s = m.section(form.GridSection, 'rule', _('目标规则'));
		s.addremove = true;
		s.anonymous = true;
		s.sortable = true;

		o = s.option(form.Flag, 'enabled', _('启用'));
		o.default = '1';
		o.rmempty = false;

		o = s.option(form.Value, 'name', _('名称'));
		o.placeholder = _('可选备注');
		o.rmempty = true;

		o = s.option(form.DummyValue, '_target_display', _('目标'));
		o.cfgvalue = function(section_id) {
			var mode = uci.get('option_wan', section_id, 'target_mode') || 'manual';
			var nodeId = uci.get('option_wan', section_id, 'passwall_node');
			var dest = uci.get('option_wan', section_id, 'dest');
			var node = passwallNodeMap[nodeId];

			if (mode === 'passwall')
				return node ? _('PassWall：') + node.label : _('PassWall 节点未选择或不存在');

			return dest || '-';
		};

		o = s.option(form.ListValue, 'target_mode', _('目标来源'));
		o.modalonly = true;
		o.default = 'manual';
		o.rmempty = false;
		o.value('manual', _('手动填写'));
		o.value('passwall', _('PassWall 节点'));

		o = s.option(form.Value, 'dest', _('公网目标 IPv4/CIDR'));
		o.modalonly = true;
		o.depends('target_mode', 'manual');
		o.placeholder = '178.83.206.79 或 203.0.113.0/24';
		o.rmempty = true;
		o.validate = function(section_id, value) {
			if (!value || isIPv4CIDR(value))
				return true;

			return _('请输入有效的 IPv4 地址或 CIDR 网段。');
		};

		o = s.option(form.DummyValue, '_dest_help', '');
		o.modalonly = true;
		o.depends('target_mode', 'manual');
		o.cfgvalue = function() {
			return helpText(_('填写远端公网 IPv4 或 CIDR，例如 178.83.206.79 或 203.0.113.0/24，不是内网客户端地址。'));
		};

		o = s.option(form.ListValue, 'passwall_node', _('PassWall 节点'));
		o.modalonly = true;
		o.depends('target_mode', 'passwall');
		o.rmempty = true;

		if (passwallNodes.length) {
			passwallNodes.forEach(function(node) {
				var id = node.id;
				var address = node.address || '';

				if (node.protocol === '_shunt' || !address)
					return;

				o.value(id, passwallNodeMap[id].label);
			});
		} else {
			o.value('', _('未检测到 PassWall 节点'));
		}

		o = s.option(form.DummyValue, '_passwall_help', '');
		o.modalonly = true;
		o.depends('target_mode', 'passwall');
		o.cfgvalue = function() {
			return helpText(_('选择 PassWall 节点后，插件会在应用规则时读取节点地址；IPv4 会直接使用，域名会解析 A 记录，IPv6 暂不处理。'));
		};

		o = s.option(form.ListValue, 'interface', _('出口接口'));
		o.rmempty = false;

		networks.forEach(function(net) {
			var name = net.getName();

			if (name !== 'loopback')
				o.value(name, name);
		});

		o = s.option(form.DummyValue, '_interface_help', '');
		o.modalonly = true;
		o.cfgvalue = function() {
			return helpText(_('选择 OpenWrt 逻辑网络接口，例如 wan2。PPPoE 重拨后会自动重新解析实际出口设备和网关。'));
		};

		this.map = m;
		return m.render();
	}
});
