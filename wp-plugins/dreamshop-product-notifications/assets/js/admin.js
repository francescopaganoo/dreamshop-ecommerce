jQuery(document).ready(function($) {
    // Handle bulk actions
    $('#doaction, #doaction2').click(function(e) {
        var action = $(this).prev('select').val();
        if (action === 'delete') {
            if (!confirm('Sei sicuro di voler eliminare le iscrizioni selezionate?')) {
                e.preventDefault();
                return false;
            }
        }
    });
    
    // Auto-refresh pending notifications count every 30 seconds
    if (window.location.href.indexOf('page=dspn-notifications') > -1) {
        setInterval(function() {
            // Subtle refresh of counts without full page reload
            $.get(window.location.href, function(data) {
                var newDoc = $(data);
                $('.nav-tab').each(function(i) {
                    var newText = newDoc.find('.nav-tab').eq(i).text();
                    if (newText !== $(this).text()) {
                        $(this).text(newText);
                    }
                });
            });
        }, 30000);
    }
    
    // Enhanced table interactions
    $('.wp-list-table tbody tr').hover(
        function() { $(this).addClass('hover'); },
        function() { $(this).removeClass('hover'); }
    );
});