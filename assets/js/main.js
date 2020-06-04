$(function() {
    //Add links to all headings
    var headings = document.querySelectorAll('h2[id],h3[id]');
    var linkContent = "<svg height='20px' width='20px' viewBox='0 0 20 20'><path d='m 20,3.559057 c 0,0.7909 -0.199163,1.448816 -0.59749,1.973746 -0.216628,0.286968 -0.821099,0.93439 -1.813414,1.942263 -0.461213,0.489937 -1.180991,1.189849 -2.159332,2.099738 -0.566036,0.46194 -1.292801,0.69291 -2.180293,0.69291 -0.489166,0 -0.981828,-0.104986 -1.477985,-0.314957 l -1.8343751,1.79527 c 0.2375941,0.636922 0.3563901,1.15486 0.3563901,1.553814 0,0.7909 -0.22362,1.466314 -0.6708593,2.026245 C 9.3920354,15.615049 8.8050331,16.237969 7.861636,17.196849 7.4213834,17.658793 6.7400411,18.330709 5.8176097,19.212597 5.2166342,19.737532 4.4758938,20 3.5953884,20 2.6450044,20 1.808177,19.641294 1.0849062,18.923882 0.36163539,18.206474 0,17.375329 0,16.430446 0,15.576555 0.23060913,14.876643 0.69182737,14.330709 0.95038651,14.022747 1.5548581,13.385825 2.5052421,12.419943 2.9245291,11.985999 3.5674359,11.352579 4.4339625,10.519683 4.6925265,10.29571 5.062898,10.103236 5.5450769,9.94226 5.9993034,9.795275 6.4116011,9.721782 6.7819703,9.721782 c 0.503144,0 0.9993017,0.118987 1.4884726,0.356959 L 10.094338,8.230972 C 9.856744,7.846019 9.7379474,7.342082 9.7379474,6.719161 c 0,-0.622926 0.1327732,-1.175858 0.3983196,-1.658796 0.237598,-0.426946 0.761708,-1.046368 1.57233,-1.858267 0.607967,-0.587926 1.215932,-1.175853 1.823895,-1.76378 C 13.714185,1.256338 13.997206,0.99737 14.381554,0.661412 14.975542,0.220471 15.656882,0 16.425573,0 17.389935,0 18.226762,0.351706 18.936054,1.055117 19.645351,1.758529 20,2.593176 20,3.559057 Z m -2.358495,0.02099 c 0,-0.32896 -0.11705,-0.614173 -0.35115,-0.85564 -0.234105,-0.241472 -0.511884,-0.362208 -0.833334,-0.362208 -0.314464,0 -0.576519,0.09099 -0.786166,0.27297 -0.216632,0.23097 -0.541579,0.570427 -0.97484,1.018371 -0.468205,0.482938 -1.111112,1.140856 -1.92872,1.973754 0.160728,-0.05599 0.321453,-0.08399 0.482176,-0.08399 0.314469,0 0.606223,0.125984 0.875263,0.377953 0.269044,0.251968 0.403567,0.535432 0.403567,0.850392 0,0.139982 -0.03844,0.31146 -0.115306,0.514433 0.894479,-0.888889 1.621243,-1.623796 2.180292,-2.20472 0.22362,-0.202979 0.52411,-0.52844 0.901471,-0.976384 0.09783,-0.160976 0.146747,-0.335953 0.146747,-0.524931 z M 7.2117371,14.46719 c -0.1397571,0.03499 -0.2795194,0.05249 -0.4192868,0.05249 -0.3284377,0 -0.625432,-0.141732 -0.8909829,-0.425196 -0.2655462,-0.283464 -0.3983193,-0.589676 -0.3983193,-0.918636 0,-0.125982 0.01747,-0.262463 0.052409,-0.409443 -0.6848382,0.629919 -1.6596812,1.616794 -2.9245292,2.960626 -0.1816886,0.216974 -0.2725328,0.451445 -0.2725328,0.703414 0,0.321963 0.1187967,0.596679 0.3563902,0.82415 0.2375985,0.227471 0.5171232,0.341206 0.8385741,0.341206 0.3004904,0 0.5276062,-0.05599 0.6813473,-0.167979 0.076866,-0.05599 0.370364,-0.335958 0.8804952,-0.839894 0.468205,-0.475941 1.1670168,-1.182854 2.096435,-2.120739 z' /></svg>";
    for (i = 0; i < headings.length; i++) {
        var heading = headings[i];
        var linkIcon = document.createElement('a');
        linkIcon.setAttribute("href", "#" + heading.id);
        linkIcon.innerHTML = linkContent;
        heading.appendChild(linkIcon);
    };

    // Static comments
    $("#comment-form").submit(function() {
        var form = this;

        $(form).addClass("disabled");
        $("#comment-form-submit").html(
        'Sending...'
        );

        $.ajax({
        type: $(this).attr("method"),
        url: $(this).attr("action"),
        data: $(this).serialize(),
        contentType: "application/x-www-form-urlencoded",
        success: function(data) {
            $("#comment-form-submit")
            .html("Submitted")
            .addClass("btn--disabled");
            $("#respond .js-notice")
            .removeClass("danger")
            .addClass("success");
            $("#respond form").hide()[0].reset();
            showAlert(
                '<strong>Thanks for your comment!</strong><br>It is <a href="https://github.com/gabeluci/gabeluci.github.io/pulls">currently pending</a> and will show on the site once approved. You will be notified if your comment is approved.'
            );
        },
        error: function(err) {
            console.log(err);
            $("#comment-form-submit").html("Submit Comment");
            $("#respond .js-notice")
            .removeClass("success")
            .addClass("danger");
            showAlert(
                "<strong>Sorry, there was an error with your submission.</strong><br>Please make sure all required fields have been completed and try again."
            );
            $(form).removeClass("disabled");
        }
        });

        return false;
    });
});

function showAlert(message) {
    $("#respond .js-notice").removeClass("hidden");
    $("#respond .js-notice-text").html(message);
}

function hideAlert() {
    $("#respond .js-notice").addClass("hidden");
    $("#respond .js-notice-text").html("");
}

// Staticman comment replies
// modified from Wordpress https://core.svn.wordpress.org/trunk/wp-includes/js/comment-reply.js
// Released under the GNU General Public License - https://wordpress.org/about/gpl/
var addComment = {
    moveForm: function(commId, parentId, respondId, postId) {
        $("#respond form").show();
        hideAlert();
        var div,
        element,
        style,
        cssHidden,
        t = this,
        comm = t.I(commId),
        respond = t.I(respondId),
        cancel = t.I("cancel-comment-reply-link"),
        parent = t.I("comment-replying-to"),
        post = t.I("comment-post-slug"),
        commentForm = respond.getElementsByTagName("form")[0];

        if (!comm || !respond || !cancel || !parent || !commentForm) {
            return;
        }

        t.respondId = respondId;
        postId = postId || false;

        if (!t.I("sm-temp-form-div")) {
            div = document.createElement("div");
            div.id = "sm-temp-form-div";
            div.style.display = "none";
            respond.parentNode.insertBefore(div, respond);
        }

        comm.parentNode.insertBefore(respond, comm.nextSibling);
        if (post && postId) {
            post.value = postId;
        }
        parent.value = parentId;
        cancel.style.display = "";

        cancel.onclick = function() {
            var t = addComment,
                temp = t.I("sm-temp-form-div"),
                respond = t.I(t.respondId);

            if (!temp || !respond) {
                return;
            }

            t.I("comment-replying-to").value = null;
            temp.parentNode.insertBefore(respond, temp);
            temp.parentNode.removeChild(temp);
            this.style.display = "none";
            this.onclick = null;
            return false;
        };

        /*
        * Set initial focus to the first form focusable element.
        * Try/catch used just to avoid errors in IE 7- which return visibility
        * 'inherit' when the visibility value is inherited from an ancestor.
        */
        try {
            for (var i = 0; i < commentForm.elements.length; i++) {
                element = commentForm.elements[i];
                cssHidden = false;

                // Modern browsers.
                if ("getComputedStyle" in window) {
                style = window.getComputedStyle(element);
                // IE 8.
                } else if (document.documentElement.currentStyle) {
                style = element.currentStyle;
                }

                /*
                * For display none, do the same thing jQuery does. For visibility,
                * check the element computed style since browsers are already doing
                * the job for us. In fact, the visibility computed style is the actual
                * computed value and already takes into account the element ancestors.
                */
                if (
                (element.offsetWidth <= 0 && element.offsetHeight <= 0) ||
                style.visibility === "hidden"
                ) {
                cssHidden = true;
                }

                // Skip form elements that are hidden or disabled.
                if ("hidden" === element.type || element.disabled || cssHidden) {
                continue;
                }

                element.focus();
                // Stop after the first focusable element.
                break;
            }
        } catch (er) {}

        return false;
    },

    I: function(id) {
        return document.getElementById(id);
    }
};