---
layout: default
title: ホーム
---

## 最新のふんわり予想

{% if site.posts.size > 0 %}
  <ul class="post-list">
    {% for post in site.posts %}
      <li>
        <h3>
          <a href="{{ post.url | relative_url }}">
            {{ post.title }}
          </a>
        </h3>
        <p class="post-meta">
          <time datetime="{{ post.date | date_to_xmlschema }}">
            {{ post.date | date: "%Y年%m月%d日" }}
            {{ post.date | date: "%H" }}:{{ post.date | date: "%M" }}
          </time>
        </p>
      </li>
    {% endfor %}
  </ul>
{% else %}
  <p>まだ投稿がありません。</p>
{% endif %}
