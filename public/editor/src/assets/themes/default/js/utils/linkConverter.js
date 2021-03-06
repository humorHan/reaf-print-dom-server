/**
 * @date     2015/2/11
 * @author   Dolphin<dolphin.w.e@gmail.com>
 * UEditor 对粘贴或键入的文本中的链接自动转换
 * <https://github.com/fex-team/ueditor/pull/1834>
 *
 * todo: 若能用正则匹配出所有非 <a> 标签的内容，则可以更快实现替换
 */

(function (UE, RCEditor, document) {
    'use strict';

    var uNode = UE.uNode,
        utils = UE.utils,
        editor = RCEditor.editor,
        domUtils = UE.dom.domUtils,
        innerText = RCEditor.innerText,
        PATTERN = /(?:https?:\/\/|ssh:\/\/|ftp:\/\/|file:\/|www\.)[^\s]*/ig;


    var keyMap = {
        9: 'tab',
        13: 'enter',
        32: 'space'
    };

    /**
     * 拆分 textNode
     * @param {textNode} textNode: 目标文字节点
     * @param {Boolean} uNodeMode: 是否 uNode 模式
     */
    var splitTextNode = function (textNode, uNodeMode) {
        var str = textNode.nodeValue,
            parentNode = textNode.parentNode,
            lastPos = 0;

        // 利用 replace 来迭代替换链接文本
        str.replace(PATTERN, function (url, pos) {
            var len = url.length,
                link = textNode.splitText(pos - lastPos),
                a = document.createElement('a');

            textNode = link.splitText(len);
            innerText(a, url);

            lastPos = len + pos;

            domUtils.setAttributes(a, {
                href: /^www/.test(url) ? 'http://' + url : url,
                title: url,
                target: '_blank'
            });

            if (!uNodeMode) {
                a.id = 'new-link';
            }

            parentNode.replaceChild(a, link);

            return '';
        });
    };

    /**
     * 迭代所有子节点
     * @param {Node} node: 目标节点
     * @param {Boolean} uNodeMode: 是否 uNode 模式
     * @param {NodeList} children
     */
    var iterateNode = function (node, uNodeMode, children /* internal */) {
        if (node.nodeType === 3) {
            return splitTextNode(node);
        }

        children = (children || node).childNodes;

        var i, max, child, content;

        for (i = 0, max = children.length; i < max; i++) {
            child = children[i];
            if (child.nodeName === 'A' || child._hasMovedLink) {
                // 跳过 <a> 元素和取消链接的元素
                continue;
            }
            if (child.nodeType === 1) {
                // element
                iterateNode(node, uNodeMode, child);
            }
            if (child.nodeType === 3) {
                // textNode
                splitTextNode(child, uNodeMode);
            }
        }
    };

    /**
     * 替换节点内容
     * @param {uNode | Node} node: 目标节点
     * @param {UE Bookmark} [bookmark]: UE 节点标签
     */
    var converter = function (node, bookmark) {
        if (node instanceof UE.uNode) {
            // uNode

            var html = node.toHtml(),
                div = document.createElement('div');

            div.innerHTML = html;
            iterateNode(div, true);

            if (div.innerHTML === html) {
                return;
            }

            var container = uNode.createElement('div');

            container.innerHTML(div.innerHTML);

            // 替换 uNode 所有子节点
            node.children = undefined;
            node.appendChild(container);
            node.removeChild(container, true);
        } else {
            // Node
            iterateNode(node);
            var a = editor.document.getElementById('new-link');
            if (a) {
                a.removeAttribute('id');

                var range = this.selection.getRange();
                range.setEndAfter(a).collapse().select();
            }
        }
    };

    /**
     * 获得当前节点最近的元素
     * @param {Node} node
     * @return {Node} 最近的元素
     */
    var getCloestElement = function (node) {
        while (node) {
            if (node.nodeType === 1) {
                return node;
            }
            node = node.parentNode;
        }
    };

    if (!UE.browser.ie) {
        // IE 自带转换
        editor.addListener('keydown', function (type, event) {
            var keyCode = event.keyCode || event.which;

            if (!keyMap[keyCode]) {
                return;
            }

            var range = editor.selection.getRange(),
                node = range.startContainer;

            if (domUtils.findParentByTagName(node, 'a', true)) {
                return;
            }

            // 创建一个新的空白文本节点，避免之后的文本也被圈入链接
            var elem = getCloestElement(node),
                textNode = document.createTextNode('');

            range.insertNode(textNode);

            converter.call(editor, elem);
        });

        editor.addInputRule(function (root) {
            var range = this.selection.getRange(),
                node = range.startContainer;

            if (domUtils.findParentByTagName(node, 'a', true)) {
                return;
            }

            converter.call(editor, root);
        });
    }
})(window.UE, window.RCEditor, document);
