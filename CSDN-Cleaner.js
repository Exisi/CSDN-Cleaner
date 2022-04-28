// ==UserScript==
// @name         CSDN-Cleaner|下载页面移除|百度搜索csdn结果优化
// @namespace    http://tampermonkey.net/
// @version      2.6
// @description  1.进入CSDN下载界面自动关闭 2.CSDN博客文章界面下推荐中有关csdn下载的链接清除 3.百度搜索界面清除CSDN下载和聚合内容的搜索结果 4.百度界面搜索结果/相同文章去重 5.对 CSDN 文章原创 / 转载、发布时间突出标识 6.增加界面表格获取按钮，对csdn博客中的表格进行获取重绘，复制格式不混乱 7.防百度预加载干扰
// @author       Exisi
// @match        https://download.csdn.net/*
// @match        http://download.csdn.net/*
// @match        https://blog.csdn.net/*
// @match        *.blog.csdn.net/article/*
// @match        *://www.baidu.com/s*
// @supportURL   https://github.com/Exisi/CSDN-Cleaner/issues/new
// ==/UserScript==

(function () {
    let url = window.location.href;
    let match = {
        download : url.match(/download.csdn/),
        blog     : url.match(/blog.csdn/),
        baidu    : url.match(/baidu.com/)
    };

    if (match["download"]) {
        //csdn下载界面关闭
        backAndClose();
    }

    if (match["blog"]) {
        let blog = {
            copyright: document.getElementsByClassName("article-copyright")[0] ? 1 : 0,
            time_content: document.getElementsByClassName("bar-content")[0],
            table_node: document.getElementsByClassName("table-box"),
            item_list: document.getElementsByClassName("recommend-item-box type_download clearfix"),
        }
        //重新标识原创和转载标签
        if (blog.copyright == 1) {
            createNewTag("原创", "red");
        } else {
            createNewTag("转载", "green");
        }
        //突出显示
        if (blog.time_content != null) {
            let time_node = blog.time_content.getElementsByClassName("time")[0];
            if (time_node != null) {
                getPostTimeDiff(time_node);
            }
        }
        //重绘表格
        if (blog.table_node[0] != null) {
            reRormatTable(blog.table_node)
        }
        //移除推荐文章中的下载
        if (blog.item_list != null) {
            articleDownloadRemove(blog.item_list);
        }
        //防csdn下载js再次加入
        window.onload = function () {
            itemRemove();
        }
    }

    if (match["baidu"]) {
        //禁止预加载
        setDiabledPreload();
        let text_list = [];
        //清除结果
        let node_list = document.getElementsByClassName("result c-container new-pmd");
        if (node_list != null) {
            //获取搜索模式
            let model = getSearchModel();
            //清除重复结果
            if (model > 0) {
                sameBlogRemove(node_list, text_list);
            }
            //根据关键字去除 CSDN下载的搜索结果
            removeCsdnDownloadByKeyword(model, node_list, text_list);
        }
    }

    /**
     * ------------------------------------------------------------------------------------------------------------*
     * 百度搜索，根据关键字去除 CSDN下载的搜索结果
     * @param node_list: 搜素结果节点列表
     * ------------------------------------------------------------------------------------------------------------*
     */
    function removeCsdnDownloadByKeyword(model, node_list, text_list) {
        for (let i in node_list) {
            let t = node_list[i].textContent;
            //暴力检索
            if (t != null) {
                let full_exist = t.search(/(CSDN下载是一个提供学习资源)|(请访问CSDN下载)|(csdn已为您找到关于)/g) > 0;
                let part_exist = t.search(/(C币\s+立即)|(立即下载\s+低至)|(次\s+身份认)|(积分\/\C币)/g) > 0;
                if (t != null && (full_exist || part_exist)) {
                    //清除baidu搜索界面的所有csdn下载链接
                    node_list[i].style.display = "none";
                }
                let text = getNodeText(model, node_list[i]);
                if (text != null) text_list.push(text);
            }
        }
    }

    /**
     * ------------------------------------------------------------------------------------------------------------*
     * 百度搜索，取消预加载
     * ------------------------------------------------------------------------------------------------------------*
     */
    function setDiabledPreload() {
        let page_content = document.getElementsByClassName("page-inner_2jZi2")[0];
        if (page_content != null) {
            let page_btn = page_content.getElementsByTagName("a");
            if (page_btn != null) {
                for (let i in page_btn) {
                    if (page_btn[i] != null) {
                        page_btn[i].onclick = function () {
                            let page_link = page_btn[i].href;
                            if (page_link != null) {
                                window.location = page_link;
                            }
                        }
                    }
                }
            }
            let submit_btn = document.getElementsByClassName("bg s_btn_wr")[0];
            if (submit_btn != null) {
                submit_btn.onclick = function () {
                    let keyword = document.getElementById("kw");
                    if (keyword != null) {
                        keyword = keyword.value;
                        let prefix = "https://www.baidu.com/s?wd=";
                        window.location = prefix + keyword;
                    }
                }
            }
        }
    }

    /**
     * ------------------------------------------------------------------------------------------------------------*
     * 百度搜索，确认搜素模式
     * @returns Int: 搜索模式（普通搜索1 / 搜题0）
     * ------------------------------------------------------------------------------------------------------------*
     */
    function getSearchModel() {
        let content = document.getElementsByClassName("f13 c-gap-top-xsmall se_st_footer user-avatar");
        let model = 0;
        if (content != null) {
            for (let i in content) {
                if (content[i].textContent != null) {
                    model = content[i].textContent.indexOf("百度题库") > -1 ? 0 : 1;
                    if (model == 0) break;
                    model = content[i].textContent.indexOf("百度文库") > -1 ? 0 : 1;
                    if (model == 0) break;
                }
            }
            return model;
        }
    }

    /**
     * ------------------------------------------------------------------------------------------------------------*
     * 百度搜索，获取每个搜索结果的文本
     * @param model: 搜索模式（普通搜索 / 搜题）
     * @param node: 搜索项的节点
     * @returns String: 返回每个搜索项的文本
     * ------------------------------------------------------------------------------------------------------------*
     */
    function getNodeText(model, node) {
        if (model > 0 && node.nodeType == 1) {
            let item_node = node.getElementsByClassName("c-abstract")[0];
            if (item_node != null) {
                let text = item_node.textContent;
                //去除csdn文章前的日期描述
                let t = text.slice(text.indexOf("日") + 1).replaceAll(" ", "").replaceAll(".", "");
                return t;
            }
        }
    }


    /**
     * ------------------------------------------------------------------------------------------------------------*
     * 百度搜索，找出可能重复的结果项
     * @param node_list 搜素结果节点列表
     * @param text_list 搜素结果文本列表
     * ------------------------------------------------------------------------------------------------------------*
     */
    function sameBlogRemove(node_list, text_list) {
        for (let i in text_list) {
            for (let j in text_list) {
                if (i != j && compare(text_list[i], text_list[j])) {
                    let key = node_list[i].textContent.search(/CSDN技术社区/g) > 0 ? i : j; //优先干掉csdn（￣へ￣）
                    // console.log("csdn?:key:===>"+key+"item:"+i);
                    //清空移除的搜索结果
                    text_list[key] = "";
                    node_list[key].style.display = "none";
                    continue;
                }
            }
        }
    }

    /**
     * ------------------------------------------------------------------------------------------------------------*
     * 百度搜索，文本结果对比
     * @param str1: 前结果文本
     * @param str2: 后结果文本
     * @returns bool: 文本是否相同
     * ------------------------------------------------------------------------------------------------------------*
     */
    function compare(str1, str2) {
        //完全匹配
        if (str1 == str2) return true;
        //残缺匹配
        if (str1.indexOf(str2.slice(1)) > 0) {
            return true;
        } else {
            return false;
        }
    }

    /**
     * ------------------------------------------------------------------------------------------------------------*
     * CSDN 文章表格，格式化表格
     * @param table_node: 表格父节点
     * ------------------------------------------------------------------------------------------------------------*
     */
    function reRormatTable(table_node) {
        for (let i in table_node) {
            if (table_node[i] != null && table_node[i].nodeType != null) {
                //查看按钮
                var btn = document.createElement("input");
                btn.setAttribute("type", "button");
                btn.setAttribute("value", "获取表格");
                btn.setAttribute("class", "btn_table");
                btn.style.background = "black";
                btn.style.marginTop = "5px";
                btn.style.color = "white";
                btn.style.padding = "6px";
                btn.style.fontWeight = "600";
                btn.style.borderRadius = "4px";
                btn.style.fontSize = "14px";
                btn.addEventListener("click", function () {
                    let table_content = table_node[i].innerHTML;
                    window.document.write(table_content); //只显示表格
                    document.getElementsByClassName("btn_table")[0].style.display = "none";
                    document.getElementsByTagName("table")[0].style.border = "1px solid #000";
                    document.getElementsByTagName("table")[0].style.borderCollapse = "collapse";
                    //绘制表头
                    let title = document.getElementsByTagName("tr")[0];
                    if (title.style != null) {
                        title.style.backgroundColor = "black";
                        title.style.color = "white";

                        let title_th = title.getElementsByTagName("th");
                        if (title_th != null) {
                            for (const i in title_th) {
                                if (title_th[i].style != null) {
                                    //强制绘制边框
                                    title_th[i].style.border = "solid #ccc 1px";
                                }
                            }
                        }

                        let title_td = title.getElementsByTagName("td");
                        if (title_td != null) {
                            for (const i in title_td) {
                                if (title_td[i].style != null) {
                                    title_td[i].style.backgroundColor = "black";
                                    title_td[i].style.color = "white";
                                    //强制绘制边框
                                    title_td[i].style.border = "solid #ccc 1px";
                                }
                            }
                        }
                    }
                    //绘制行
                    let item = document.getElementsByTagName("tr");
                    for (let t in item) {
                        if (item[t] != null && item[t].nodeType != null) {
                            let all_item = item[t].getElementsByTagName("td");
                            for (const j in all_item) {
                                if (all_item[j].style != null) {
                                    //强制绘制边框
                                    all_item[j].style.border = "solid #ccc 1px";
                                }
                            }
                            if (t > 0 && t % 2 == 0) {
                                let second_item = item[t].getElementsByTagName("td");
                                for (const j in second_item) {
                                    if (second_item[j].style != null) {
                                        //奇数表格显色
                                        second_item[j].style.backgroundColor = "#e7e6e6";
                                    }
                                }
                            }
                        }
                    }
                })
                table_node[i].appendChild(btn);
            }
        }
    }

    /**
     * ------------------------------------------------------------------------------------------------------------*
     * CSDN 替换文章标签
     * @param type: 标签类型（原创 / 转载）
     * @param color: 预设的标签颜色（红 / 绿）
     * ------------------------------------------------------------------------------------------------------------*
     */
    function createNewTag(type, color) {
        let tag = {
            node  : document.getElementsByClassName("article-bar-top")[0],
            tag   : document.getElementsByClassName("article-type-img")[0],
            parent: document.getElementsByClassName("blog-tags-box")[0],
        }
        let new_tag = {
            tag: document.createElement("div"),
            next: document.getElementsByClassName("tags-box artic-tag-box")[0],
        }
        if (tag.node != null && tag.tag != null && tag.parent != null) {
            tag.tag.style.display = "none";
            new_tag.tag.innerHTML += "<div id='taga_content' " +
                                        "style='background:white;height:35px;width:35px;border-radius:5px;" +
                                            "border:1px solid " + color + ";transform: rotate(-45deg);display:flex;" +
                                            "justify-content:center;align-items:center;margin-right:20px;" +
                                            "margin-left:-25px;'>" +
                                        "<button id='new_tag' " +
                                            "style='background:none;" +
                                                "color:" + color + ";transform:rotate(45deg);text-align: center;" +
                                                "display: inline-block;font-size:12px;padding:2px;'>" + type + "" +
                                            "</button>" +
                                        "</div>";
            tag.parent.prepend(new_tag.tag);
            if (new_tag.next != null) new_tag.next.style.paddingTop = "6px";
            let btn = document.getElementById("new_tag");
            btn.addEventListener("click", function () {
                let link = document.createElement("a");
                link.setAttribute("href", "#pcCommentBox");
                link.click();
            });
        }
    }

    /**
     * ------------------------------------------------------------------------------------------------------------*
     * CSDN 文章发布时间，获取并计算时间差
     * @param time_node: 发布时间原节点
     * ------------------------------------------------------------------------------------------------------------*
     */
    function getPostTimeDiff(time_node) {
        let time = time_node.textContent;
        time = time.replace("已于", "").replace("于", "").split(" ")[0].trim();
        let date = {
            post    : new Date(time),
            current : new Date(),
            color   : "green",
        }
        let diff = new Date(date.current - date.post).getFullYear() - 1970;
        let level = {
            early    : diff <= 1 ? 1 : 0,
            late     : 1 < diff && diff <= 3 ? 1 : 0,
            out_time : diff > 3 ? 1 : 0,
        }
        if (level.early){
            date.color = 'green';
        }
        if (level.late){
            date.color = 'blue';
        }
        if (level.out_time){
            date.color = 'red';
        }
        markPostTime(date.color, time);
        if(level.out_time){
            document.getElementById("post_date_text").style.textDecoration = "line-through";
        }
        let post_img = document.getElementsByClassName("article-time-img article-heard-img")[0];
        if (post_img != null){
            post_img.style.display = "none";
            time_node.style.display = "none";
        }
    }

    /**
     * ------------------------------------------------------------------------------------------------------------*
     * CSDN 文章发布时间，突出标识
     * @param color: 文字和边框颜色（1年以内-绿色，3年内-蓝色，3年以上-红色）
     * @param time: 发布时间
     * ------------------------------------------------------------------------------------------------------------*
     */
    function markPostTime(color, time){
        let article_content = document.getElementsByClassName("blog-content-box")[0];
        if (article_content != null) {
            let new_node = document.createElement("div");
            new_node.innerHTML += "<p id='post_date_text'"+
                                        "style='float:right;margin-right:-15px;color:" + color +
                                            ";margin-top:10px;border-radius:30px;border-width:1px;"+
                                            "border-style:solid;border-color:"+ color +
                                            ";padding-left:5px;padding-right:5px;'>"
                                        + time +
                                  "</p>";
            article_content.prepend(new_node);
        }
    }

    /**
     * ------------------------------------------------------------------------------------------------------------*
     * CSDN 文章推荐，下载移除
     * @param item_list: 文章推荐父节点
     * ------------------------------------------------------------------------------------------------------------*
     */
    function articleDownloadRemove(itemList) {
        //删除底部文章推荐中的 csdn下载
        for (let i in itemList) {
            if (itemList[i].style != null) {
                itemList[i].style.display = "none";
            }
        }
    }

    /**
     * ------------------------------------------------------------------------------------------------------------*
     * CSDN 文章异步推荐，下载移除
     * ------------------------------------------------------------------------------------------------------------*
     */
    function itemRemove() {
        let errorItemList = document.getElementsByClassName("recommend-item-box baiduSearch clearfix");
        if (errorItemList != null) {
            for (let i = 0; i < errorItemList.length; i++) {
                let link = errorItemList[i].getElementsByTagName("a")[0].href;
                if (link.match(/download.csdn/)) {
                    errorItemList[i].style.display = "none";
                }
            }
        }
    }

    /**
     * ------------------------------------------------------------------------------------------------------------*
     * CSDN 下载界面，关闭
     * ------------------------------------------------------------------------------------------------------------*
     */
    function backAndClose() {
        if (window.history.length > 1) {
            //当前标签页打开后退
            window.history.back();
        } else {
            //新标签页打开直接关闭
            window.close();
        }
    }
})();
