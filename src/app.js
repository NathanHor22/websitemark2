$(document).ready(function(){
    $(".intro-section")
        .hide()
        .css("opacity", 0)
        .slideDown(600, function() {
            $(this).addClass("visible").animate({ opacity: 1 }, 600);
        });
});