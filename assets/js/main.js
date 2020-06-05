$(function() {
    //Add links to all headings
    var headings = document.querySelectorAll('h2[id],h3[id],h4[id]');
    var linkContent = "<svg height='20px' width='20px' viewBox='0 0 20 20'><path d='m 16.488195,0.00273135 c -0.88823,0.0144 -1.75235,0.44153 -2.34376,1.10536005 -1.091,1.04408 -2.20379,2.06933 -3.21065,3.19642 -0.45191,0.52372 -0.82882,1.15419 -0.89314,1.85808 -0.0782,0.63006 -0.0143,1.29653 0.29115,1.86271 0.0235,0.0738 0.14058,0.1527 0.10166,0.21726 -0.7189898,0.72836 -1.4380198,1.45669 -2.1569798,2.1850796 -0.85686,-0.5118796 -1.93452,-0.5473896 -2.85591,-0.19282 -0.56149,0.18027 -1.05239,0.53742 -1.43807,0.97884 -1.18809,1.16886 -2.39092,2.32904 -3.47281997,3.59838 -0.55988,0.83322 -0.64412,1.9262 -0.32318,2.86207 0.36897,1.00299 1.21848997,1.82005 2.23098997,2.16498 1.00828,0.32722 2.20009,0.15646 3.02421,-0.52225 0.40228,-0.34415 0.7601,-0.74098 1.14831,-1.10337 0.9871,-0.97569 1.97164,-1.95805 2.87859,-3.00877 0.5885298,-0.81116 0.6980198,-1.90981 0.3633,-2.84647 -0.0671,-0.21446 -0.14558,-0.4242 -0.22329,-0.63554 0.7176598,-0.70229 1.4353098,-1.40458 2.1529698,-2.1068596 1.05607,0.5150096 2.37323,0.5295196 3.3926,-0.095 0.56882,-0.39539 1.0184,-0.93171 1.53009,-1.3959 0.95897,-0.94991 1.92077,-1.90113 2.79067,-2.93343 0.52289,-0.73991 0.62809,-1.70997 0.43506,-2.58083 -0.35519,-1.50223 -1.82886,-2.66857005 -3.37936,-2.60848005 -0.0141,1.6e-4 -0.0283,3.4e-4 -0.0424,5.1e-4 z m 0.1555,1.86406005 c 0.91083,-0.0193 1.68131,0.9527 1.46189,1.83514 -0.12539,0.50286 -0.56532,0.82881 -0.88987,1.20133 -1.10115,1.13429 -2.22175,2.24937 -3.34207,3.36472 0.0751,-0.55145 0.4475,-1.01515 0.49337,-1.57222 10e-4,-0.51309 -0.46969,-0.93826 -0.96089,-0.99099 -0.43036,-0.0281 -0.8097,0.2143 -1.20572,0.34606 -0.14489,0.0558 -0.29275,0.10333 -0.4402,0.15187 1.35506,-1.34524 2.65865,-2.74316 4.01612,-4.08647 0.25315,-0.17308 0.56324,-0.24872 0.86737,-0.24944 z M 5.8812352,12.152721 c -0.0805,0.43514 -0.27883,0.87766 -0.19558,1.32015 0.0887,0.36814 0.36825,0.68455 0.71725,0.82993 0.3768,0.15297 0.77297,-0.0248 1.14437,-0.105 0.15471,-0.0397 0.3124,-0.0659 0.4709,-0.0848 -1.28348,1.23124 -2.47076,2.56075 -3.79064,3.75452 -0.55588,0.35246 -1.33419,0.28067 -1.83667,-0.13518 -0.47681,-0.402 -0.69262,-1.13753 -0.38814,-1.70456 0.2552,-0.49224 0.72287,-0.81903 1.07498,-1.23502 0.91312,-0.95177 1.83977,-1.89281 2.8319,-2.76296 -0.009,0.041 -0.0189,0.0819 -0.0284,0.12291 z' /></svg>";
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